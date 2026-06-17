import { Redirect } from 'expo-router';

/**
 * The dedicated model-download experience has been removed during the
 * backend-chat pivot. The route is preserved so deep links / typed-route
 * stragglers still resolve, but it just bounces the user into chat.
 */
export default function DownloadingRoute() {
  return <Redirect href="/(tabs)/chat" />;
}
