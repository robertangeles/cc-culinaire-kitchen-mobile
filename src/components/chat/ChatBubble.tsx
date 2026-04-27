import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { fonts, palette, radii, spacing, type } from '@/constants/theme';
import type { Message } from '@/types/chat';

interface ChatBubbleProps {
  message: Message;
  onPressImage?: (uri: string) => void;
}

export function ChatBubble({ message, onPressImage }: ChatBubbleProps) {
  const isUser = message.role === 'user';
  return (
    <Animated.View
      entering={FadeInDown.duration(240)}
      style={[styles.row, isUser ? styles.alignRight : styles.alignLeft]}
    >
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
        {message.imageUri ? (
          <Pressable
            onPress={() => message.imageUri && onPressImage?.(message.imageUri)}
            style={styles.imageWrap}
          >
            <Image source={{ uri: message.imageUri }} style={styles.image} contentFit="cover" />
          </Pressable>
        ) : null}
        {message.content ? (
          <Text style={[styles.text, isUser ? styles.userText : styles.aiText]}>
            {message.content}
          </Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: spacing.s4, paddingVertical: spacing.s1 },
  alignRight: { alignItems: 'flex-end' },
  alignLeft: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '85%',
    paddingHorizontal: spacing.s4,
    paddingVertical: spacing.s3,
    borderRadius: radii.md,
    gap: spacing.s2,
  },
  userBubble: {
    backgroundColor: palette.ink,
    borderBottomRightRadius: 6,
  },
  aiBubble: {
    backgroundColor: palette.paperDeep,
    borderColor: palette.paperEdge,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftColor: palette.copper,
    borderLeftWidth: 2,
    borderBottomLeftRadius: 6,
  },
  text: { ...type.body, fontFamily: fonts.body },
  userText: { color: palette.textOnInk },
  aiText: { color: palette.ink },
  imageWrap: { borderRadius: radii.sm, overflow: 'hidden' },
  image: { width: 220, height: 220, borderRadius: radii.sm },
});
