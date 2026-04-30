import { useCallback, useRef } from 'react';

import { start as startDownload, type DownloadHandle } from '@/services/modelDownloadService';
import { useModelStore } from '@/store/modelStore';

export function useModelDownload() {
  const handleRef = useRef<DownloadHandle | null>(null);
  const state = useModelStore((s) => s.state);
  const progress = useModelStore((s) => s.progress);
  const error = useModelStore((s) => s.error);
  const isActive = useModelStore((s) => s.isActive);
  const wifiOnly = useModelStore((s) => s.wifiOnly);
  const setDownloading = useModelStore((s) => s.setDownloading);
  const setReady = useModelStore((s) => s.setReady);
  const setIdle = useModelStore((s) => s.setIdle);
  const setError = useModelStore((s) => s.setError);

  const start = useCallback(() => {
    if (handleRef.current) return;
    setDownloading(0);
    handleRef.current = startDownload({
      wifiOnly,
      onProgress: setDownloading,
      onDone: () => {
        handleRef.current = null;
        setReady();
      },
      onError: (e) => {
        handleRef.current = null;
        setError(e.message);
      },
    });
  }, [setDownloading, setReady, setError, wifiOnly]);

  const cancel = useCallback(() => {
    handleRef.current?.cancel();
    handleRef.current = null;
    setIdle();
  }, [setIdle]);

  // No unmount cleanup. The download is a long-running foreground service
  // (WorkManager + Room) designed to survive backgrounding, screen
  // unmounts, and process kills. Cancelling on unmount fires for every
  // navigation — including the success path where DownloadingScreen
  // unmounts after onDone routes to chat — and races worker SHA-256
  // verification, marking COMPLETED files as user_cancelled and deleting
  // them via the native cancelDownload. If the user wants to abort, they
  // tap the explicit Cancel UI which calls the returned `cancel`.

  return { state, progress, error, isActive, start, cancel };
}
