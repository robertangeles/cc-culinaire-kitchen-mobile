import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';
import { useAntoine } from '@/hooks/useAntoine';
import { useAuth } from '@/hooks/useAuth';
import { useConversation } from '@/hooks/useConversation';
import { useI18nStore } from '@/store/i18nStore';
import { useModelStore } from '@/store/modelStore';

import { ChatComposer } from './ChatComposer';
import { ChatHeader } from './ChatHeader';
import { ChatList } from './ChatList';
import { HistorySheet } from './HistorySheet';
import { LanguagePickerSheet } from './LanguagePickerSheet';
import { PartialLanguageBanner } from './PartialLanguageBanner';
import {
  GlobeIcon,
  HistoryIcon,
  KebabMenu,
  type KebabItem,
  NewChatIcon,
  SettingsGearIcon,
  SignOutIcon,
  TrashIcon,
} from './KebabMenu';

export function ChatScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isModelActive = useModelStore((s) => s.isActive);
  const { signOut } = useAuth();
  const { conversations, activeId, messages, setActive, newConversation, clearActive } =
    useConversation();
  const { send } = useAntoine();

  // Keyboard avoidance lives at the screen level, not in ChatComposer. With
  // edgeToEdgeEnabled: true (app.config.ts), Android's adjustResize is a
  // no-op and KeyboardAvoidingView is unreliable. We lift the IME height
  // to the root view as paddingBottom so flex re-layouts the entire chat
  // area when the keyboard appears.
  //
  // Why explicit `Keyboard.addListener` instead of `useAnimatedKeyboard()`:
  // on Android 14+ with edgeToEdgeEnabled, useAnimatedKeyboard sometimes
  // leaves `height.value` stuck at the prior keyboard height after a
  // swipe-down or tap-outside dismissal — the keyboardDidHide event
  // doesn't always propagate cleanly through the animated wrapper. The
  // result is the composer staying lifted with empty space underneath
  // even though no keyboard is visible. Listening directly to the
  // imperative Keyboard events and animating a sharedValue ourselves is
  // boring and reliable.
  //
  // CRITICAL: subtract the tab bar's CONTENT height, not its full height.
  // useBottomTabBarHeight() includes insets.bottom (the gesture-nav-bar
  // safe area). Android edge-to-edge's keyboardDidShow reports
  // e.endCoordinates.height as the keyboard panel only — it does NOT
  // include the nav-bar area sitting above it. Subtracting the full
  // tabBarHeight double-counts insets.bottom and under-lifts by ~insets.bottom,
  // leaving the composer hidden behind the keyboard's suggestion toolbar.
  const tabBarHeight = useBottomTabBarHeight();
  const tabBarContentHeight = Math.max(0, tabBarHeight - insets.bottom);
  const keyboardHeight = useSharedValue(0);
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      keyboardHeight.value = withTiming(e.endCoordinates.height, { duration: 250 });
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      keyboardHeight.value = withTiming(0, { duration: 250 });
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardHeight]);
  const rootStyle = useAnimatedStyle(() => ({
    paddingBottom: Math.max(0, keyboardHeight.value - tabBarContentHeight),
  }));

  const [kebabOpen, setKebabOpen] = useState(false);
  const historyRef = useRef<BottomSheetModal>(null);
  const languageRef = useRef<BottomSheetModal>(null);
  const language = useI18nStore((s) => s.language);

  const onSend = useCallback((text: string) => void send(text), [send]);

  const items: KebabItem[] = [
    {
      id: 'new',
      label: t('chat.newChat'),
      Icon: NewChatIcon,
      onPress: () => void newConversation(),
    },
    {
      id: 'history',
      label: t('chat.history'),
      Icon: HistoryIcon,
      onPress: () => historyRef.current?.present(),
    },
    {
      id: 'clear',
      label: t('chat.clearConversation'),
      Icon: TrashIcon,
      onPress: () => void clearActive(),
    },
    { divider: true },
    {
      id: 'lang',
      label: t('chat.language'),
      Icon: GlobeIcon,
      onPress: () => languageRef.current?.present(),
      trailing: language.toUpperCase(),
    },
    {
      id: 'settings',
      label: t('chat.settings'),
      Icon: SettingsGearIcon,
      onPress: () => router.push('/(tabs)/settings'),
    },
    { divider: true },
    {
      id: 'signout',
      label: t('chat.signOut'),
      Icon: SignOutIcon,
      onPress: async () => {
        await signOut();
        router.replace('/(welcome)');
      },
      danger: true,
    },
  ];

  return (
    <Animated.View style={[styles.root, { paddingTop: insets.top }, rootStyle]}>
      <ChatHeader
        modelReady={isModelActive}
        onPressDownload={() => router.push('/(tabs)/settings')}
        onPressMore={() => setKebabOpen(true)}
      />

      <PartialLanguageBanner />

      <ChatList messages={messages} />

      <ChatComposer onSend={onSend} />

      <HistorySheet
        ref={historyRef}
        conversations={conversations}
        activeId={activeId}
        onPick={(id) => {
          historyRef.current?.dismiss();
          void setActive(id);
        }}
      />

      <LanguagePickerSheet ref={languageRef} />

      <KebabMenu visible={kebabOpen} onClose={() => setKebabOpen(false)} items={items} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
});
