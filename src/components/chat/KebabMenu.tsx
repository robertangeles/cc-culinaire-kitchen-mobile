import { type ComponentType } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts, palette, radii, shadows, spacing } from '@/constants/theme';

import type { IconProps } from './icons-types';
import {
  GlobeIcon,
  HistoryIcon,
  NewChatIcon,
  SettingsGearIcon,
  SignOutIcon,
  TrashIcon,
} from './icons';

export interface KebabAction {
  id: string;
  label: string;
  Icon: ComponentType<IconProps>;
  onPress: () => void;
  trailing?: string;
  danger?: boolean;
  divider?: never;
}
export interface KebabDivider {
  divider: true;
}
export type KebabItem = KebabAction | KebabDivider;

interface KebabMenuProps {
  visible: boolean;
  onClose: () => void;
  items: KebabItem[];
}

export function KebabMenu({ visible, onClose, items }: KebabMenuProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <View style={[styles.menu, { top: insets.top + 56, right: spacing.s4 }]}>
          {items.map((item, i) => {
            if ('divider' in item) {
              return <View key={`d${i}`} style={styles.divider} />;
            }
            const { Icon } = item;
            return (
              <Pressable
                key={item.id}
                onPress={() => {
                  onClose();
                  item.onPress();
                }}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                accessibilityRole="button"
                accessibilityLabel={item.label}
              >
                <Icon size={18} color={item.danger ? palette.ember : palette.ink} />
                <Text style={[styles.label, item.danger && styles.danger]} numberOfLines={1}>
                  {item.label}
                </Text>
                {item.trailing ? (
                  <View style={styles.trailingPill}>
                    <Text style={styles.trailingText}>{item.trailing}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </Pressable>
    </Modal>
  );
}

// Re-export icon types for KebabMenu consumers.
export { HistoryIcon, NewChatIcon, TrashIcon, GlobeIcon, SettingsGearIcon, SignOutIcon };

const styles = StyleSheet.create({
  scrim: { flex: 1 },
  menu: {
    position: 'absolute',
    minWidth: 220,
    backgroundColor: palette.paperSoft,
    borderColor: palette.paperEdge,
    borderWidth: 1,
    borderRadius: radii.md - 2,
    padding: 6,
    ...shadows.e2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s3,
    paddingHorizontal: spacing.s2 + 2,
    paddingVertical: spacing.s2 + 2,
    borderRadius: radii.sm,
  },
  rowPressed: { backgroundColor: palette.paperDeep },
  label: { flex: 1, fontFamily: fonts.uiBold, fontSize: 14, color: palette.ink },
  danger: { color: palette.ember },
  divider: { height: 1, backgroundColor: palette.paperEdge, marginVertical: 4 },
  trailingPill: {
    backgroundColor: palette.copperTint,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  trailingText: {
    fontFamily: fonts.uiBold,
    fontSize: 11,
    letterSpacing: 1.32,
    textTransform: 'uppercase',
    color: palette.copperDeep,
  },
});
