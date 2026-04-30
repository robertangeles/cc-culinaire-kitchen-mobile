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
      const userMessage = makeMessage(conversationId, 'user', content, imageUri);
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
        console.info(
          `[useAntoine] stage=retrieving — fetching prompt${
            isFirstRagFetch ? ' + RAG (first turn)' : ''
          }${!isFirstRagFetch ? ` (RAG reused from cache, ${cachedChunks.length} chunks)` : ''}`,
        );
        const ragPromise: Promise<RagChunk[]> = isFirstRagFetch
          ? retrieve(content, { limit: 2 })
          : Promise.resolve(cachedChunks);
        const [systemPrompt, ragChunks] = await Promise.all([getActivePrompt(), ragPromise]);
        if (isFirstRagFetch && ragChunks.length > 0) {
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
        const ragBlock = formatRagContext(ragChunks);
        const history: InferenceMessage[] = [...messages, userMessage].map((m) => ({
          role: m.role === 'system' ? 'system' : m.role,
          content: m.content,
        }));
        const inferenceMessages: InferenceMessage[] = [
          { role: 'system', content: systemPrompt },
          ...(ragBlock ? [{ role: 'system' as const, content: ragBlock }] : []),
          ...history,
        ];

        // Stage 3 — stream tokens.
        setStreamingStage('streaming');
        const totalChars = inferenceMessages.reduce((n, m) => n + m.content.length, 0);
        console.info(
          `[useAntoine] stage=streaming — messages=${inferenceMessages.length} chars=${totalChars} (~${Math.ceil(totalChars / 4)}tok)`,
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
