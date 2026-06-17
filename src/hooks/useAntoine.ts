import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { ChatAbortError, streamChat } from '@/services/chatService';
import { isNetworkError } from '@/services/__errors__';
import { useAuthStore } from '@/store/authStore';
import { useConversationStore } from '@/store/conversationStore';
import type { ChatWireMessage, Message } from '@/types/chat';

/**
 * useAntoine — chat orchestrator for the backend-chat pivot (2026-06-15).
 *
 * Replaces the retired on-device llama.rn hook. `send` now:
 *   1. Ensures an active conversation (creating one if needed).
 *   2. Persists the user message (SQLite mirror + backend) via the store.
 *   3. Streams the assistant reply from `POST /api/chat`, piping each token
 *      into the conversation store's streaming slice so the bubble renders
 *      live.
 *   4. Commits the final assistant text (SQLite mirror + backend).
 *
 * Abort + error handling: a per-send `AbortController` lets the screen stop
 * an in-flight reply; transport/HTTP failures clear the streaming bubble and
 * surface a plain-language alert (never a raw error string).
 */
function makeMessageId(): string {
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useAntoine() {
  const { t } = useTranslation();
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (content: string) => {
      const text = content.trim();
      if (text.length === 0 || isThinking) return;
      setError(null);

      const store = useConversationStore.getState();
      const user = useAuthStore.getState().user;
      if (!user) return; // The chat screen is auth-gated; defensive only.

      // Ensure an active conversation to attach the message to.
      let conversationId = store.activeId;
      if (!conversationId) {
        conversationId = await store.startNew(String(user.userId));
      }

      // Persist the user's message (store handles SQLite + backend).
      const userMessage: Message = {
        id: makeMessageId(),
        conversationId,
        role: 'user',
        content: text,
        createdAt: Date.now(),
      };
      await store.addMessage(conversationId, userMessage);

      // Build the wire history the stateless backend needs (oldest first,
      // user/assistant only — the system prompt is injected server-side).
      const history: ChatWireMessage[] = (
        useConversationStore.getState().messages[conversationId] ?? []
      )
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      const controller = new AbortController();
      abortRef.current = controller;
      setIsThinking(true);
      useConversationStore.getState().startStreaming(conversationId);

      try {
        const finalText = await streamChat({
          messages: history,
          token: useAuthStore.getState().token,
          signal: controller.signal,
          onTextDelta: (delta) => useConversationStore.getState().appendStreamingToken(delta),
        });
        await useConversationStore.getState().commitStreaming(conversationId, finalText);
      } catch (e) {
        useConversationStore.getState().clearStreaming();
        // An intentional abort is not an error — leave the UI quiet.
        if (!(e instanceof ChatAbortError)) {
          const message = isNetworkError(e) ? t('chat.errorOffline') : t('chat.errorGeneric');
          setError(message);
          Alert.alert(t('chat.errorTitle'), message);
        }
      } finally {
        setIsThinking(false);
        abortRef.current = null;
      }
    },
    [isThinking, t],
  );

  /** Stop the in-flight reply (e.g. the user navigated away or pressed stop). */
  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { send, abort, isThinking, error };
}
