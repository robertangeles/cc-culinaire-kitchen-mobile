import { useCallback, useState } from 'react';

import {
  buildMessageArray,
  completion,
  initLlama,
  type LlamaContext,
} from '@/services/inferenceService';
import { getMainModelPath } from '@/services/modelLocator';
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
  const isModelActive = useModelStore((s) => s.isActive);
  const activeId = useConversationStore((s) => s.activeId);
  const messages = useConversationStore((s) =>
    activeId ? (s.messages[activeId] ?? EMPTY_MESSAGES) : EMPTY_MESSAGES,
  );
  const addMessage = useConversationStore((s) => s.addMessage);
  const startNew = useConversationStore((s) => s.startNew);
  const startStreaming = useConversationStore((s) => s.startStreaming);
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

      if (!isModelActive) {
        const fallback = makeMessage(
          conversationId,
          'assistant',
          'Pick a Chef to start. Open Settings → On-device Chef to download Antoine.',
        );
        await addMessage(conversationId, fallback);
        return;
      }

      setIsThinking(true);
      try {
        const ctx = await ensureContext();
        const history: InferenceMessage[] = [...messages, userMessage].map((m) => ({
          role: m.role === 'system' ? 'system' : m.role,
          content: m.content,
        }));
        startStreaming(conversationId);
        const result = await completion(ctx, { messages: buildMessageArray(history) }, (token) =>
          appendStreamingToken(token),
        );
        await commitStreaming(conversationId, result.text);
      } catch (e) {
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
      isModelActive,
      messages,
      addMessage,
      startNew,
      startStreaming,
      appendStreamingToken,
      commitStreaming,
      clearStreaming,
    ],
  );

  return { send, isThinking, error };
}
