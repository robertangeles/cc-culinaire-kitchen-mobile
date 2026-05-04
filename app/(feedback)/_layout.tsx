import { Stack } from 'expo-router';

export default function FeedbackLayout() {
  // presentation: 'modal' surfaces drag-to-dismiss + native modal chrome
  // on both iOS and Android. headerShown: false lets the screen render
  // its own paper-toned header per the editorial design system.
  return <Stack screenOptions={{ headerShown: false, presentation: 'modal' }} />;
}
