import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetFlatList,
  BottomSheetModal,
} from '@gorhom/bottom-sheet';
import { forwardRef, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fonts, palette, spacing } from '@/constants/theme';
import type { Conversation } from '@/types/chat';

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
  const snapPoints = useMemo(() => ['50%', '90%'], []);

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.bg}
      handleIndicatorStyle={styles.handle}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>HISTORY</Text>
      </View>
      {conversations.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.empty}>No conversations yet. Start one from the chat screen.</Text>
        </View>
      ) : (
        <BottomSheetFlatList
          data={conversations}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onPick(item.id)}
              style={[styles.row, activeId === item.id && styles.rowActive]}
              accessibilityRole="button"
              accessibilityLabel={item.title ?? 'Untitled conversation'}
            >
              <View style={styles.rowBody}>
                <Text style={styles.title} numberOfLines={1}>
                  {item.title ?? 'Untitled conversation'}
                </Text>
                <Text style={styles.meta}>{relativeTime(item.updatedAt)}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  bg: { backgroundColor: palette.paper },
  handle: { backgroundColor: palette.paperEdge, width: 40 },
  header: { paddingHorizontal: spacing.s5, paddingTop: spacing.s2 },
  eyebrow: {
    fontFamily: fonts.uiBold,
    fontSize: 11,
    letterSpacing: 1.98,
    color: palette.copperDeep,
  },
  list: { paddingBottom: spacing.s8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.s5,
    paddingVertical: spacing.s3,
  },
  rowActive: { backgroundColor: palette.copperTint },
  rowBody: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.s3,
    alignItems: 'center',
  },
  title: { flex: 1, fontFamily: fonts.uiBold, fontSize: 14, color: palette.ink },
  meta: { fontFamily: fonts.ui, fontSize: 12, color: palette.inkMuted, flexShrink: 0 },
  emptyWrap: { padding: spacing.s5 },
  empty: { fontFamily: fonts.body, fontSize: 14, color: palette.inkMuted },
});
