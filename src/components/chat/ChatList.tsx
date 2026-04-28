import { FlatList, type ListRenderItemInfo, StyleSheet } from 'react-native';

import { ChatBubble } from '@/components/chat/ChatBubble';
import { ChatGreeting } from '@/components/chat/ChatGreeting';
import { spacing } from '@/constants/theme';
import type { Message } from '@/types/chat';

interface ChatListProps {
  messages: Message[];
  onPressImage?: (uri: string) => void;
}

export function ChatList({ messages, onPressImage }: ChatListProps) {
  if (messages.length === 0) {
    // Empty-state ownership now belongs to ChatGreeting. The download CTA
    // that previously lived here ("Pick a Chef") moved into the
    // first-launch flow: users without a model auto-route to
    // /(downloading) before they can reach this screen, so by the time
    // we render an empty chat the model is already ready.
    return <ChatGreeting />;
  }

  return (
    <FlatList
      data={messages}
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
