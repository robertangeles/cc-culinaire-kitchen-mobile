import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { DownloadingScreen } from '@/components/onboarding/DownloadingScreen';
import { useModelDownload } from '@/hooks/useModelDownload';
import { useModelStore } from '@/store/modelStore';

/**
 * First-launch download experience. Auto-starts the model download on
 * mount and routes to the chat once the model is ready. Replaces the
 * old "user must navigate to Settings and tap Choose & download" flow.
 */
export default function DownloadingRoute() {
  const router = useRouter();
  const { start } = useModelDownload();
  const progress = useModelStore((s) => s.progress);

  const onComplete = useCallback(() => {
    router.replace('/(tabs)/chat');
  }, [router]);

  return <DownloadingScreen progress={progress} onMount={start} onComplete={onComplete} />;
}
