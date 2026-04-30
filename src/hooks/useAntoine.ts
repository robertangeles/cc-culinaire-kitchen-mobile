import { useCallback, useState } from 'react';

import { completion, initLlama, type LlamaContext } from '@/services/inferenceService';
import { getMainModelPath } from '@/services/modelLocator';
import { getActivePrompt } from '@/services/promptCacheService';
import { formatRagContext, retrieve } from '@/services/ragService';
import { useAuthStore } from '@/store/authStore';
import { useConversationStore } from '@/store/conversationStore';
import { useModelStore } from '@/store/modelStore';
import type { Message } from '@/types/chat';
import type { InferenceMessage } from '@/types/inference';

// Stable empty-array reference for the messages selector — see useConversation.ts
// for the full explanation. Returning a fresh `[]` from a Zustand selector
// causes infinite re-renders when there's no active conversation.
const EMPTY_MESSAGES: Message[] = [];

// Module-level context cache. Multi-second cold load on first message; cached
// for the JS lifetime after that. TODO: invalidate on settings reconfigure
// (release the context, set to null) once the path-override UI ships.
let cachedContext: LlamaContext | null = null;

async function ensureContext(): Promise<LlamaContext> {
  if (cachedContext) return cachedContext;
  const modelPath = await getMainModelPath();
  cachedContext = await initLlama({ model: modelPath });
  return cachedContext;
}

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
        // Stage 1 — fetch system prompt from cache + retrieve RAG chunks
        // in parallel. Both are best-effort: prompt falls back to baked-in
        // default, RAG returns [] if endpoint is offline/missing.
        setStreamingStage('retrieving');
        console.info('[useAntoine] stage=retrieving — fetching prompt + RAG');
        const [systemPrompt, ragChunks] = await Promise.all([
          getActivePrompt(),
          // limit=2 — even with chunks clipped to 400 chars, three 1500+
          // char source chunks + the system prompt + chat-template
          // wrappers were still overflowing n_ctx=1536.
          retrieve(content, { limit: 2 }),
        ]);
        console.info(
          `[useAntoine] retrieving done — prompt=${systemPrompt.length}b chunks=${ragChunks.length}`,
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
