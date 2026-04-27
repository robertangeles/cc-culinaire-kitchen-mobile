import { FlatList, type ListRenderItemInfo, StyleSheet, Text, View } from 'react-native';

import { ChatBubble } from '@/components/chat/ChatBubble';
import { CopperButton } from '@/components/ui/CopperButton';
import { palette, spacing, theme, type } from '@/constants/theme';
import type { Message } from '@/types/chat';

interface ChatListProps {
  messages: Message[];
  modelReady: boolean;
  onOpenSettings: () => void;
  onPressImage?: (uri: string) => void;
}

export function ChatList({ messages, modelReady, onOpenSettings, onPressImage }: ChatListProps) {
  if (messages.length === 0) {
    return (
      <View style={styles.empty}>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>{modelReady ? 'Ask Antoine.' : 'Pick a Chef.'}</Text>
          <Text style={styles.emptyBody}>
            {modelReady
              ? 'Try: "How do I rescue a broken hollandaise?" or "Walk me through a 12-cover dinner for tonight."'
              : 'Antoine runs on this phone. Download once, then ask anything — recipes, conversions, prep, troubleshooting.'}
          </Text>
          {!modelReady ? (
            <CopperButton onPress={onOpenSettings}>Choose & download</CopperButton>
          ) : null}
        </View>
      </View>
    );
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
  empty: {
    flex: 1,
    backgroundColor: theme.bg,
    paddingHorizontal: spacing.s5,
    justifyContent: 'center',
  },
  emptyCard: {
    backgroundColor: palette.paperDeep,
    borderRadius: spacing.s4,
    borderColor: palette.paperEdge,
    borderWidth: 1,
    padding: spacing.s5,
    gap: spacing.s3,
  },
  emptyTitle: { ...type.h3, color: palette.ink },
  emptyBody: { ...type.body, color: palette.inkSoft, marginBottom: spacing.s2 },
  list: { paddingVertical: spacing.s3 },
});
