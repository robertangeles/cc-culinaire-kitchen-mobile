import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { forwardRef, useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fonts, palette, radii, spacing } from '@/constants/theme';

import { CameraIcon, ChevIcon, FileIcon, LibraryIcon } from './icons';

export type AttachmentResult = { type: 'image' | 'file'; uri: string };

interface AttachmentSheetProps {
  onPicked: (result: AttachmentResult) => void;
  /**
   * Called BEFORE each picker (camera / library / files) launches so
   * the bottom sheet animates closed first. Without this, the sheet
   * stays mounted while the picker intent is up — taps that confirm
   * a photo selection in the camera UI can leak through to the still-
   * pressable "Take photo" row underneath, re-firing the picker after
   * the user thought they were done.
   */
  requestDismiss?: () => void;
}

function renderBackdrop(props: BottomSheetBackdropProps) {
  return <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />;
}

export const AttachmentSheet = forwardRef<BottomSheetModal, AttachmentSheetProps>(
  function AttachmentSheet({ onPicked, requestDismiss }, ref) {
    const snapPoints = useMemo(() => ['40%'], []);

    const onCamera = useCallback(async () => {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== 'granted') return;
      // Dismiss the sheet BEFORE the camera intent launches so its rows
      // can't intercept the "select photo" tap when the user returns.
      requestDismiss?.();
      const r = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.85 });
      if (!r.canceled && r.assets[0]) onPicked({ type: 'image', uri: r.assets[0].uri });
    }, [onPicked, requestDismiss]);

    const onLibrary = useCallback(async () => {
      requestDismiss?.();
      const r = await ImagePicker.launchImageLibraryAsync({ allowsEditing: false, quality: 0.85 });
      if (!r.canceled && r.assets[0]) onPicked({ type: 'image', uri: r.assets[0].uri });
    }, [onPicked, requestDismiss]);

    const onFiles = useCallback(async () => {
      requestDismiss?.();
      const r = await DocumentPicker.getDocumentAsync({
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (!r.canceled && r.assets[0]) onPicked({ type: 'file', uri: r.assets[0].uri });
    }, [onPicked, requestDismiss]);

    const items: readonly {
      id: string;
      label: string;
      sub: string;
      Icon: typeof CameraIcon;
      onPress: () => void;
    }[] = [
      {
        id: 'camera',
        label: 'Take photo',
        sub: 'Identify, OCR, or critique a plate',
        Icon: CameraIcon,
        onPress: onCamera,
      },
      {
        id: 'library',
        label: 'Photo library',
        sub: 'Pick from your camera roll',
        Icon: LibraryIcon,
        onPress: onLibrary,
      },
      {
        id: 'files',
        label: 'Files',
        sub: 'PDFs, recipe cards, spreadsheets',
        Icon: FileIcon,
        onPress: onFiles,
      },
    ];

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.bg}
        handleIndicatorStyle={styles.handle}
      >
        <BottomSheetView style={styles.container}>
          <Text style={styles.eyebrow}>ATTACH</Text>
          {items.map((it, i) => (
            <Pressable
              key={it.id}
              onPress={it.onPress}
              style={[styles.row, i > 0 && styles.rowDivider]}
              accessibilityRole="button"
              accessibilityLabel={it.label}
            >
              <View style={styles.iconWrap}>
                <it.Icon size={22} color={palette.copperDeep} />
              </View>
              <View style={styles.body}>
                <Text style={styles.label}>{it.label}</Text>
                <Text style={styles.sub}>{it.sub}</Text>
              </View>
              <ChevIcon size={18} color={palette.inkFaint} />
            </Pressable>
          ))}
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

const styles = StyleSheet.create({
  bg: { backgroundColor: palette.paper },
  handle: { backgroundColor: palette.paperEdge, width: 40 },
  container: { paddingHorizontal: spacing.s4, paddingBottom: spacing.s8 },
  eyebrow: {
    fontFamily: fonts.uiBold,
    fontSize: 11,
    letterSpacing: 1.98,
    color: palette.copperDeep,
    paddingVertical: spacing.s3,
    paddingHorizontal: spacing.s2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s3 + 2,
    paddingVertical: spacing.s3,
    paddingHorizontal: spacing.s2,
  },
  rowDivider: { borderTopColor: palette.paperEdge, borderTopWidth: StyleSheet.hairlineWidth },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.sm + 2,
    backgroundColor: palette.copperTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  label: { fontFamily: fonts.uiBold, fontSize: 16, color: palette.ink },
  sub: { fontFamily: fonts.body, fontSize: 13, color: palette.inkMuted, marginTop: 2 },
});
