import { useCallback, useEffect } from 'react';

import { useAuthStore } from '@/store/authStore';
import { useConversationStore } from '@/store/conversationStore';

export function useConversation() {
  // Backend userId is `number`; local SQLite stores it as `text`. Coerce at
  // the boundary so the on-device schema stays opaque to backend type changes.
  const userId = useAuthStore((s) => (s.user ? String(s.user.userId) : null));
  const dbReady = useConversationStore((s) => s.dbReady);
  const conversations = useConversationStore((s) => s.conversations);
  const activeId = useConversationStore((s) => s.activeId);
  const messages = useConversationStore((s) => (activeId ? (s.messages[activeId] ?? []) : []));
  const hydrate = useConversationStore((s) => s.hydrate);
  const startNew = useConversationStore((s) => s.startNew);
  const setActive = useConversationStore((s) => s.setActive);
  const clearActive = useConversationStore((s) => s.clearActive);

  useEffect(() => {
    if (!dbReady || !userId) return;
    void hydrate(userId);
  }, [dbReady, userId, hydrate]);

  const newConversation = useCallback(async () => {
    if (!userId) return null;
    return startNew(userId);
  }, [userId, startNew]);

  return {
    conversations,
    activeId,
    messages,
    setActive,
    newConversation,
    clearActive,
  };
}
