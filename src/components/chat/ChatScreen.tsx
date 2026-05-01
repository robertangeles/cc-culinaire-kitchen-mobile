import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Keyboard, Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts, palette, spacing, theme } from '@/constants/theme';
import { useAntoine } from '@/hooks/useAntoine';
import { useAuth } from '@/hooks/useAuth';
import { useConversation } from '@/hooks/useConversation';
import { useModelStore } from '@/store/modelStore';

import { AttachmentSheet } from './AttachmentSheet';
import { ChatComposer } from './ChatComposer';
import { ChatHeader } from './ChatHeader';
import { ChatList } from './ChatList';
import { HistorySheet } from './HistorySheet';
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
import { PressToTalk } from './PressToTalk';
import { XIcon } from './icons';

export function ChatScreen() {
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
  const [recording, setRecording] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const attachmentRef = useRef<BottomSheetModal>(null);
  const historyRef = useRef<BottomSheetModal>(null);

  const onSend = useCallback((text: string) => void send(text), [send]);

  // The sheet is now dismissed BEFORE the picker launches (see
  // AttachmentSheet.requestDismiss), so by the time onPicked fires the
  // sheet is already animating out — no need to dismiss again here.
  const onAttachmentPicked = useCallback(
    (r: { type: 'image' | 'file'; uri: string }) => {
      void send(
        r.type === 'image' ? '' : `[file: ${r.uri.split('/').pop() ?? 'attachment'}]`,
        r.uri,
      );
    },
    [send],
  );

  const dismissAttachmentSheet = useCallback(() => {
    attachmentRef.current?.dismiss();
  }, []);

  const onMicPress = useCallback(() => {
    setRecording(true);
    setTimeout(() => {
      setRecording(false);
      void send('Mocked transcript: pretend the user spoke a question here.');
    }, 1100);
  }, [send]);

  const items: KebabItem[] = [
    {
      id: 'new',
      label: 'New chat',
      Icon: NewChatIcon,
      onPress: () => void newConversation(),
    },
    {
      id: 'history',
      label: 'History',
      Icon: HistoryIcon,
      onPress: () => historyRef.current?.present(),
    },
    {
      id: 'clear',
      label: 'Clear conversation',
      Icon: TrashIcon,
      onPress: () => void clearActive(),
    },
    { divider: true },
    {
      id: 'lang',
      label: 'Language',
      Icon: GlobeIcon,
      onPress: () => undefined,
      trailing: 'EN',
    },
    {
      id: 'settings',
      label: 'Settings',
      Icon: SettingsGearIcon,
      onPress: () => router.push('/(tabs)/settings'),
    },
    { divider: true },
    {
      id: 'signout',
      label: 'Sign out',
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

      <ChatList messages={messages} onPressImage={(uri) => setPreviewUri(uri)} />

      <ChatComposer
        onSend={onSend}
        onPressAttach={() => attachmentRef.current?.present()}
        onPressMic={onMicPress}
      />

      <AttachmentSheet
        ref={attachmentRef}
        onPicked={onAttachmentPicked}
        requestDismiss={dismissAttachmentSheet}
      />
      <HistorySheet
        ref={historyRef}
        conversations={conversations}
        activeId={activeId}
        onPick={(id) => {
          historyRef.current?.dismiss();
          void setActive(id);
        }}
      />

      <KebabMenu visible={kebabOpen} onClose={() => setKebabOpen(false)} items={items} />
      <PressToTalk visible={recording} />

      {previewUri ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setPreviewUri(null)}>
          <Pressable style={imgStyles.scrim} onPress={() => setPreviewUri(null)}>
            <Image source={{ uri: previewUri }} style={imgStyles.image} />
            <View style={imgStyles.close}>
              <XIcon size={24} color={palette.textOnInk} />
            </View>
          </Pressable>
        </Modal>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
});

const imgStyles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(16,20,24,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.s5,
  },
  image: { width: '100%', height: '70%', resizeMode: 'contain' },
  close: { position: 'absolute', top: 60, right: 24, fontFamily: fonts.uiBold },
});
