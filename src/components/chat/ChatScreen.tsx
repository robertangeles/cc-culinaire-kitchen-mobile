import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';
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

  const [kebabOpen, setKebabOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const attachmentRef = useRef<BottomSheetModal>(null);
  const historyRef = useRef<BottomSheetModal>(null);

  const onSend = useCallback((text: string) => void send(text), [send]);

  const onAttachmentPicked = useCallback(
    (r: { type: 'image' | 'file'; uri: string }) => {
      attachmentRef.current?.dismiss();
      void send(
        r.type === 'image' ? '' : `[file: ${r.uri.split('/').pop() ?? 'attachment'}]`,
        r.uri,
      );
    },
    [send],
  );

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
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ChatHeader
        modelReady={isModelActive}
        onPressDownload={() => router.push('/(tabs)/settings')}
        onPressMore={() => setKebabOpen(true)}
      />

      <ChatList
        messages={messages}
        modelReady={isModelActive}
        onOpenSettings={() => router.push('/(tabs)/settings')}
        onPressImage={(uri) => setPreviewUri(uri)}
      />

      <ChatComposer
        onSend={onSend}
        onPressAttach={() => attachmentRef.current?.present()}
        onPressMic={onMicPress}
      />

      <AttachmentSheet ref={attachmentRef} onPicked={onAttachmentPicked} />
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
    </View>
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
