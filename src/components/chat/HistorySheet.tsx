import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetFlatList,
  BottomSheetModal,
} from '@gorhom/bottom-sheet';
import { forwardRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts, palette, spacing } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';
import { useConversationStore } from '@/store/conversationStore';
import type { Conversation } from '@/types/chat';

import { TrashIcon } from './icons';

interface HistorySheetProps {
  conversations: Conversation[];
  activeId: string | null;
  onPick: (id: string) => void;
}

function renderBackdrop(props: BottomSheetBackdropProps) {
  return <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />;
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

export const HistorySheet = forwardRef<BottomSheetModal, HistorySheetProps>(function HistorySheet(
  { conversations, activeId, onPick },
  ref,
) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => (s.user ? String(s.user.userId) : null));
  const removeConversation = useConversationStore((s) => s.removeConversation);
  const clearAllConversations = useConversationStore((s) => s.clearAllConversations);

  const snapPoints = useMemo(() => ['50%', '90%'], []);
  const untitled = t('chat.untitledConversation');

  const onPressDelete = (conv: Conversation) => {
    Alert.alert(t('chat.confirmDeleteTitle'), t('chat.confirmDeleteBody'), [
      { text: t('chat.confirmCancel'), style: 'cancel' },
      {
        text: t('chat.confirmDelete'),
        style: 'destructive',
        onPress: () => {
          void removeConversation(conv.id);
        },
      },
    ]);
  };

  const onPressClearAll = () => {
    if (!userId) return;
    Alert.alert(t('chat.confirmClearAllTitle'), t('chat.confirmClearAllBody'), [
      { text: t('chat.confirmCancel'), style: 'cancel' },
      {
        text: t('chat.confirmClearAll'),
        style: 'destructive',
        onPress: () => {
          void clearAllConversations(userId);
        },
      },
    ]);
  };

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      // Force the configured snap points instead of letting the sheet
      // auto-size to content height. Without this, @gorhom/bottom-sheet
      // v5+ defaults `enableDynamicSizing: true`, which on a sparsely-
      // populated history list collapses the sheet to ~25% of the screen
      // — partially hidden behind the Android nav bar.
      enableDynamicSizing={false}
      // Respect the bottom safe-area inset (Android nav bar / iOS home
      // indicator) so the last conversation row isn't obscured by system UI.
      bottomInset={insets.bottom}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.bg}
      handleIndicatorStyle={styles.handle}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{t('chat.historyTitle')}</Text>
        {conversations.length > 0 ? (
          <Pressable
            onPress={onPressClearAll}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('chat.clearAll')}
          >
            <Text style={styles.clearAll}>{t('chat.clearAll')}</Text>
          </Pressable>
        ) : null}
      </View>
      {conversations.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.empty}>{t('chat.emptyHistory')}</Text>
        </View>
      ) : (
        <BottomSheetFlatList
          data={conversations}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={[styles.row, activeId === item.id && styles.rowActive]}>
              <Pressable
                onPress={() => onPick(item.id)}
                style={styles.rowMain}
                accessibilityRole="button"
                accessibilityLabel={item.title ?? untitled}
              >
                <View style={styles.rowBody}>
                  <Text style={styles.title} numberOfLines={1}>
                    {item.title ?? untitled}
                  </Text>
                  <Text style={styles.meta}>{relativeTime(item.updatedAt)}</Text>
                </View>
              </Pressable>
              <Pressable
                onPress={() => onPressDelete(item)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t('chat.deleteConversationLabel')}
                style={styles.deleteBtn}
              >
                <TrashIcon size={18} color={palette.inkMuted} />
              </Pressable>
            </View>
          )}
        />
      )}
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  bg: { backgroundColor: palette.paper },
  handle: { backgroundColor: palette.paperEdge, width: 40 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.s5,
    paddingTop: spacing.s2,
  },
  eyebrow: {
    fontFamily: fonts.uiBold,
    fontSize: 11,
    letterSpacing: 1.98,
    color: palette.copperDeep,
  },
  clearAll: {
    fontFamily: fonts.uiBold,
    fontSize: 12,
    letterSpacing: 0.9,
    color: palette.ember,
    paddingVertical: spacing.s1,
  },
  list: { paddingBottom: spacing.s8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.s5,
  },
  rowActive: { backgroundColor: palette.copperTint },
  rowMain: {
    flex: 1,
    minWidth: 0,
    paddingVertical: spacing.s3,
  },
  rowBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.s3,
  },
  title: { flex: 1, fontFamily: fonts.uiBold, fontSize: 14, color: palette.ink },
  meta: { fontFamily: fonts.ui, fontSize: 12, color: palette.inkMuted, flexShrink: 0 },
  deleteBtn: {
    paddingHorizontal: spacing.s2,
    paddingVertical: spacing.s2,
    marginLeft: spacing.s2,
  },
  emptyWrap: { padding: spacing.s5 },
  empty: { fontFamily: fonts.body, fontSize: 14, color: palette.inkMuted },
});
