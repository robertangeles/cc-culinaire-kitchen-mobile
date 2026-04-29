import { FlatList, type ListRenderItemInfo, StyleSheet } from 'react-native';

import { ChatBubble } from '@/components/chat/ChatBubble';
import { ChatGreeting } from '@/components/chat/ChatGreeting';
import { spacing } from '@/constants/theme';
import { useConversationStore } from '@/store/conversationStore';
import type { Message } from '@/types/chat';

interface ChatListProps {
  messages: Message[];
  onPressImage?: (uri: string) => void;
}

// Stable ID for the virtual streaming bubble. Lives outside the component
// so React keys stay stable across renders.
const STREAMING_ID = '__streaming__';

export function ChatList({ messages, onPressImage }: ChatListProps) {
  const activeId = useConversationStore((s) => s.activeId);
  const streamingConversationId = useConversationStore((s) => s.streamingConversationId);
  const streamingText = useConversationStore((s) => s.streamingText);

  // Show the virtual streaming bubble only when streaming targets the
  // currently-active conversation. Persisted assistant message has not
  // landed in SQLite yet — the partial text lives in Zustand only.
  const isStreaming =
    !!activeId && streamingConversationId === activeId && streamingText.length > 0;

  if (messages.length === 0 && !isStreaming) {
    return <ChatGreeting />;
  }

  const data: Message[] = isStreaming
    ? [
        ...messages,
        {
          id: STREAMING_ID,
          conversationId: activeId!,
          role: 'assistant',
          content: streamingText,
          createdAt: Date.now(),
        },
      ]
    : messages;

  return (
    <FlatList
      data={data}
      keyExtractor={(m) => m.id}
      renderItem={({ item }: ListRenderItemInfo<Message>) => (
        <ChatBubble message={item} onPressImage={onPressImage} />
      )}
      contentContainerStyle={styles.list}
      keyboardShouldPersistTaps="handled"
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: spacing.s3 },
});
