import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { fonts, palette, radii, spacing, theme } from '@/constants/theme';

import { MicIcon, SendIcon } from './icons';

interface ChatComposerProps {
  onSend: (text: string) => void;
  onPressMic: () => void;
  disabled?: boolean;
}

export function ChatComposer({ onSend, onPressMic, disabled = false }: ChatComposerProps) {
  const [text, setText] = useState('');
  const canSend = text.trim().length > 0 && !disabled;

  const submit = useCallback(() => {
    if (!canSend) return;
    onSend(text.trim());
    setText('');
  }, [canSend, text, onSend]);

  // Composer is presentational only. Keyboard avoidance lives at ChatScreen
  // (parent) — the entire chat root view applies paddingBottom = keyboard
  // height so flex re-layouts naturally. See ChatScreen.tsx for the rationale.
  return (
    <View style={styles.wrapper}>
      <View style={styles.bar}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Message Antoine"
          placeholderTextColor={palette.inkFaint}
          multiline
          style={styles.input}
          onSubmitEditing={submit}
          submitBehavior="submit"
        />
        {text.trim().length > 0 ? (
          <Pressable
            onPress={submit}
            style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            <SendIcon size={20} color={palette.textOnCopper} />
          </Pressable>
        ) : (
          <Pressable
            onPress={onPressMic}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Hold to talk"
            hitSlop={6}
          >
            <MicIcon size={22} color={palette.inkSoft} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: theme.bg,
    borderTopColor: theme.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.s4,
    paddingTop: spacing.s2,
    paddingBottom: spacing.s4,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.s2,
    backgroundColor: palette.paperDeep,
    borderColor: palette.paperEdge,
    borderWidth: 1,
    borderRadius: radii.lg + 4,
    paddingHorizontal: spacing.s2,
    paddingVertical: spacing.s2,
    minHeight: 52,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 16,
    color: palette.ink,
    maxHeight: 120,
    paddingVertical: 6,
    paddingHorizontal: spacing.s2,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.copper,
  },
  sendBtnDisabled: { opacity: 0.5 },
});
