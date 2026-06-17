import { Redirect, Stack } from 'expo-router';

import { KITCHEN_ENABLED } from '@/constants/config';

/**
 * Kitchen tab stack. headerShown:false — the hub and placeholder draw their
 * own editorial headers (matching ChatHeader), never the native one.
 *
 * Build-gate (D4): when KITCHEN_ENABLED is false (store-review build) the
 * whole sub-tree redirects to chat, so the routes aren't just hidden from
 * the tab bar — they're unreachable, even via deep link.
 */
export default function KitchenStackLayout() {
  if (!KITCHEN_ENABLED) {
    return <Redirect href="/(tabs)/chat" />;
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}
