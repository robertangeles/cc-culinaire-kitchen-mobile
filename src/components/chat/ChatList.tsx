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

/**
 * Subtitle text for the in-progress assistant bubble before tokens
 * arrive. Replaces the earlier UX gap where the user saw nothing
 * happening between sending a message and the first token landing
 * (which can be 5–30s on first message due to model load + prompt
 * processing on a phone CPU).
 */
function stageSubtitle(stage: 'retrieving' | 'warming' | 'streaming' | null): string {
  switch (stage) {
    case 'retrieving':
      return 'Antoine is consulting your library…';
    case 'warming':
      return 'Antoine is warming up…';
    default:
      return '';
  }
}

export function ChatList({ messages, onPressImage }: ChatListProps) {
  const activeId = useConversationStore((s) => s.activeId);
  const streamingConversationId = useConversationStore((s) => s.streamingConversationId);
  const streamingText = useConversationStore((s) => s.streamingText);
  const streamingStage = useConversationStore((s) => s.streamingStage);

  // Show the virtual streaming bubble whenever a stream targets the
  // currently-active conversation — even before the first token arrives.
  // Pre-token, we render the stage subtitle (`Consulting your library…`,
  // `Warming up…`); once tokens flow we replace it with the live text.
  const isStreamingThisConversation =
    !!activeId && streamingConversationId === activeId && streamingStage !== null;

  if (messages.length === 0 && !isStreamingThisConversation) {
    return <ChatGreeting />;
  }

  // Bubble content priority: live tokens > stage subtitle.
  const bubbleContent = streamingText.length > 0 ? streamingText : stageSubtitle(streamingStage);

  const data: Message[] = isStreamingThisConversation
    ? [
        ...messages,
        {
          id: STREAMING_ID,
          conversationId: activeId!,
          role: 'assistant',
          content: bubbleContent,
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
