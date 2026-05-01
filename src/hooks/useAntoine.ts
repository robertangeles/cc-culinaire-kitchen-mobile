import { useCallback, useState } from 'react';

import { completion, ensureContext } from '@/services/inferenceService';
import {
  markKvHandled,
  saveSystemPromptKV,
  wasKvHandledThisSession,
} from '@/services/kvSessionService';
import { getActivePrompt } from '@/services/promptCacheService';
import { formatRagContext, retrieve, type RagChunk } from '@/services/ragService';
import { useAuthStore } from '@/store/authStore';
import { useConversationStore } from '@/store/conversationStore';
import { useModelStore } from '@/store/modelStore';
import type { Message } from '@/types/chat';
import type { InferenceMessage } from '@/types/inference';

// Stable empty-array reference for the messages selector — see useConversation.ts
// for the full explanation. Returning a fresh `[]` from a Zustand selector
// causes infinite re-renders when there's no active conversation.
const EMPTY_MESSAGES: Message[] = [];

/**
 * Default user-visible text injected when the caller fires an image-only
 * send (photo attached, no typed text). Without this, the user-message
 * bubble would render as an image with no caption AND Antoine would
 * receive an empty user-text turn — neither composes well across the
 * five real-world image use cases (identify, fix, technique, plate idea,
 * critique). The chef-voiced default opens the door without committing
 * to a specific intent; Antoine's reply naturally branches based on
 * what the photo actually shows.
 */
const IMAGE_ONLY_DEFAULT_TEXT = "Take a look at this. What's your read?";

/**
 * Appended to the active system prompt whenever the current send carries
 * an image. Reframes Antoine's response to be image-aware regardless of
 * what (if anything) the user typed alongside the photo. Kept short to
 * preserve token budget AND deliberately avoids any "first… then…"
 * sequencing that Gemma 3n reads as a chain-of-thought trigger — empirically
 * any imperative-stepwise phrasing here makes the model emit a
 * `<|channel|>thought` block into the user-visible output, even with
 * `chat_template_kwargs.enable_thinking = ''` set on the completion call.
 */
const SYSTEM_PROMPT_IMAGE_ADDENDUM =
  '\n\nAn image is attached. Use it as the primary context for your reply.';

function makeMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  imageUri?: string,
): Message {
  const id = `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const base: Message = { id, conversationId, role, content, createdAt: Date.now() };
  return imageUri ? { ...base, imageUri } : base;
}

export function useAntoine() {
  // Backend userId is `number`; local SQLite stores it as `text`. Coerce at
  // the boundary so the on-device schema stays opaque to backend type changes.
  const userId = useAuthStore((s) => (s.user ? String(s.user.userId) : null));
  // The hot path reads `isActive` via `useModelStore.getState()` inside
  // `send()` (after the hydration gate), so we don't subscribe to it here
  // — that would just trigger spurious re-creates of `send` whenever the
  // model state flips. We DO subscribe to `isPrefsHydrated` because the
  // gate's wait loop wants to short-circuit immediately on the synchronous
  // case where hydration already finished by the time send() is called.
  const isPrefsHydrated = useModelStore((s) => s.isPrefsHydrated);
  const activeId = useConversationStore((s) => s.activeId);
  const messages = useConversationStore((s) =>
    activeId ? (s.messages[activeId] ?? EMPTY_MESSAGES) : EMPTY_MESSAGES,
  );
  const addMessage = useConversationStore((s) => s.addMessage);
  const startNew = useConversationStore((s) => s.startNew);
  const startStreaming = useConversationStore((s) => s.startStreaming);
  const setStreamingStage = useConversationStore((s) => s.setStreamingStage);
  const appendStreamingToken = useConversationStore((s) => s.appendStreamingToken);
  const commitStreaming = useConversationStore((s) => s.commitStreaming);
  const clearStreaming = useConversationStore((s) => s.clearStreaming);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    async (content: string, imageUri?: string) => {
      if (!userId) return;
      setError(null);
      const conversationId = activeId ?? (await startNew(userId));

      // Image-only sends arrive here with content === '' (the attachment
      // sheet's onAttachmentPicked fires send('', uri) with no chance to
      // type). Inject a chef-voiced default so the user-message bubble
      // is parseable, RAG has a query, and Antoine has a real prompt.
      const hasImage = !!imageUri;
      const effectiveContent =
        content.trim().length === 0 && hasImage ? IMAGE_ONLY_DEFAULT_TEXT : content;
      const userMessage = makeMessage(conversationId, 'user', effectiveContent, imageUri);
      await addMessage(conversationId, userMessage);

      // Wait for the boot disk-check to complete before deciding the
      // model is missing. Otherwise a fast user tap on a freshly
      // reloaded JS bundle can race hydration and incorrectly fall back
      // to "Pick a Chef" while the GGUF is sitting on disk.
      if (!isPrefsHydrated) {
        const start = Date.now();
        while (!useModelStore.getState().isPrefsHydrated && Date.now() - start < 3000) {
          await new Promise((r) => setTimeout(r, 50));
        }
      }
      const modelActiveNow = useModelStore.getState().isActive;
      if (!modelActiveNow) {
        const fallback = makeMessage(
          conversationId,
          'assistant',
          'Pick a Chef to start. Open Settings → On-device Chef to download Antoine.',
        );
        await addMessage(conversationId, fallback);
        return;
      }

      setIsThinking(true);
      startStreaming(conversationId);
      try {
        // Stage 1 — fetch system prompt from cache + RAG chunks (cached
        // per-conversation) in parallel. Both are best-effort: prompt
        // falls back to baked-in default, RAG returns [] if endpoint is
        // offline/missing.
        //
        // RAG chunks are cached at the conversation level. The first
        // user message of a conversation triggers `retrieve()`; if it
        // returns chunks, they're frozen for the rest of the
        // conversation (every subsequent turn reuses them via
        // Promise.resolve, no network call). This stabilises the
        // message-array structure across turns so llama.cpp's automatic
        // prompt cache reuses the prefix instead of re-prefilling 700+
        // tokens of system prompt + RAG block on every send.
        //
        // Empty results are intentionally NOT cached: `chunks=0` is
        // often a transient web-side miss (embedding service blip,
        // conversational follow-up below the topic threshold). Leaving
        // the cache `undefined` lets the next turn retry naturally —
        // which matters when a conversation opens with chitchat and
        // then asks a real culinary question on turn 2.
        setStreamingStage('retrieving');
        const cachedChunks =
          useConversationStore.getState().ragChunksByConversation[conversationId];
        const isFirstRagFetch = cachedChunks === undefined;
        // Defensive guard: ragService.retrieve throws on an empty query
        // (it's a programmer-error assertion). The image-only injection
        // above means `effectiveContent` should always be non-empty by
        // the time we reach here, but keep the skip path so a future
        // call site that fires send('', undefined) doesn't crash.
        const trimmedContent = effectiveContent.trim();
        const skipRag = trimmedContent.length === 0;
        console.info(
          `[useAntoine] stage=retrieving — fetching prompt${
            skipRag ? ' (RAG skipped — empty query, defensive)' : ''
          }${!skipRag && isFirstRagFetch ? ' + RAG (first turn)' : ''}${
            !skipRag && !isFirstRagFetch
              ? ` (RAG reused from cache, ${cachedChunks.length} chunks)`
              : ''
          }`,
        );
        const ragPromise: Promise<RagChunk[]> = skipRag
          ? Promise.resolve([])
          : isFirstRagFetch
            ? retrieve(trimmedContent, { limit: 2 })
            : Promise.resolve(cachedChunks);
        const [systemPrompt, ragChunks] = await Promise.all([getActivePrompt(), ragPromise]);
        if (!skipRag && isFirstRagFetch && ragChunks.length > 0) {
          // Freeze the first non-empty result for the rest of this
          // conversation. We deliberately skip caching empty arrays so
          // the next turn can retry retrieval.
          useConversationStore.getState().setRagChunksForConversation(conversationId, ragChunks);
        }
        console.info(
          `[useAntoine] retrieving done — prompt=${systemPrompt.length}b chunks=${ragChunks.length}${
            isFirstRagFetch ? ` (cached=${ragChunks.length > 0})` : ' (reused)'
          }`,
        );

        // Stage 2 — model load (cached after first call). The first
        // message of a session takes multi-seconds; subsequent messages
        // are near-instant.
        setStreamingStage('warming');
        console.info('[useAntoine] stage=warming — ensureContext');
        const ctx = await ensureContext();
        console.info('[useAntoine] context ready');

        // Build the message array. System prompt first, then optional
        // RAG context block as a second system message, then conversation
        // history. The model is instructed (via the system prompt or
        // training) to cite [n] references when the RAG block is present.
        //
        // When this turn has an image attached, append the photo
        // addendum to the system message — frames Antoine to look at
        // the photo first and ground his guidance in what he observes.
        const ragBlock = formatRagContext(ragChunks);
        const systemContent = hasImage
          ? `${systemPrompt}${SYSTEM_PROMPT_IMAGE_ADDENDUM}`
          : systemPrompt;

        // Visibility check: if the user attached an image but the
        // multimodal projector isn't initialized on this context, the
        // model receives no image bytes and will hallucinate content.
        // Warn loudly so this regression is obvious in logcat — fall
        // back to text-only inference rather than failing.
        const visionAvailable = ctx.multimodalEnabled;
        if (hasImage && !visionAvailable) {
          console.warn(
            '[useAntoine] image attached but multimodal projector not initialized — model will run text-only on this turn (will hallucinate content for the image)',
          );
        }

        // For each historical user message that carries an imageUri,
        // build OAI-style content parts so the model receives the
        // image bytes. Plain string content stays for text-only
        // messages and assistant replies.
        const history: InferenceMessage[] = [...messages, userMessage].map((m) => {
          const isUserWithImage = m.role === 'user' && !!m.imageUri && visionAvailable;
          if (isUserWithImage) {
            const fileUri = m.imageUri!.startsWith('file://')
              ? m.imageUri!
              : `file://${m.imageUri}`;
            return {
              role: 'user',
              content: [
                { type: 'image_url' as const, image_url: { url: fileUri } },
                ...(m.content ? [{ type: 'text' as const, text: m.content }] : []),
              ],
            };
          }
          return {
            role: m.role === 'system' ? 'system' : m.role,
            content: m.content,
          };
        });
        const inferenceMessages: InferenceMessage[] = [
          { role: 'system', content: systemContent },
          ...(ragBlock ? [{ role: 'system' as const, content: ragBlock }] : []),
          ...history,
        ];

        // Stage 3 — stream tokens.
        setStreamingStage('streaming');
        // String-content sum for the log; content-part messages
        // contribute roughly the text part's length.
        const totalChars = inferenceMessages.reduce((n, m) => {
          if (typeof m.content === 'string') return n + m.content.length;
          return (
            n + m.content.reduce((p, part) => (part.type === 'text' ? p + part.text.length : p), 0)
          );
        }, 0);
        console.info(
          `[useAntoine] stage=streaming — messages=${inferenceMessages.length} chars=${totalChars} (~${Math.ceil(totalChars / 4)}tok)${
            hasImage && visionAvailable ? ' [vision]' : ''
          }`,
        );
        const result = await completion(ctx, { messages: inferenceMessages }, (token) =>
          appendStreamingToken(token),
        );
        console.info(`[useAntoine] completion done — text=${result.text.length}b`);

        // Commit the model's reply verbatim. The RAG chunks were the
        // model's PRIVATE context (passed via the system message above)
        // — they are not part of the user-visible message and must not
        // be appended to the committed text. Antoine's inline [n]
        // citations remain in the rendered message; the chunk text +
        // titles never appear in the chat UI.
        await commitStreaming(conversationId, result.text);

        // After the first successful completion of this JS lifetime,
        // save the system-prompt slice of the KV cache so the NEXT
        // app launch can skip system-prompt prefill via loadSession.
        // Cuts turn 1 cold-launch prefill ~78s -> ~37s.
        //
        // Set the flag synchronously BEFORE the async save so that a
        // concurrent send() doesn't fire a second save. If the save
        // throws (disk full, write error), we still skip retries this
        // session — the next launch will retry naturally.
        if (!wasKvHandledThisSession()) {
          markKvHandled();
          void saveSystemPromptKV(ctx, systemPrompt).catch((err) => {
            console.warn('[useAntoine] saveSystemPromptKV failed:', err);
          });
        }
      } catch (e) {
        console.error('[useAntoine] send() failed:', e);
        clearStreaming();
        const fallback = makeMessage(
          conversationId,
          'assistant',
          e instanceof Error
            ? `${e.message} Try again in a moment.`
            : 'Antoine stalled. Try the question again.',
        );
        await addMessage(conversationId, fallback);
        setError(e instanceof Error ? e.message : 'Inference failed');
      } finally {
        setIsThinking(false);
      }
    },
    [
      userId,
      activeId,
      isPrefsHydrated,
      messages,
      addMessage,
      startNew,
      startStreaming,
      setStreamingStage,
      appendStreamingToken,
      commitStreaming,
      clearStreaming,
    ],
  );

  return { send, isThinking, error };
}
