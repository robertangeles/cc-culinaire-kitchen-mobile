import { useCallback, useEffect, useRef } from 'react';

import { start as startDownload, type DownloadHandle } from '@/services/modelDownloadService';
import { useModelStore } from '@/store/modelStore';

export function useModelDownload() {
  const handleRef = useRef<DownloadHandle | null>(null);
  const state = useModelStore((s) => s.state);
  const progress = useModelStore((s) => s.progress);
  const error = useModelStore((s) => s.error);
  const isActive = useModelStore((s) => s.isActive);
  const setDownloading = useModelStore((s) => s.setDownloading);
  const setReady = useModelStore((s) => s.setReady);
  const setIdle = useModelStore((s) => s.setIdle);
  const setError = useModelStore((s) => s.setError);

  const start = useCallback(() => {
    if (handleRef.current) return;
    setDownloading(0);
    handleRef.current = startDownload({
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
  }, [setDownloading, setReady, setError]);

  const cancel = useCallback(() => {
    handleRef.current?.cancel();
    handleRef.current = null;
    setIdle();
  }, [setIdle]);

  useEffect(() => {
    return () => {
      handleRef.current?.cancel();
      handleRef.current = null;
    };
  }, []);

  return { state, progress, error, isActive, start, cancel };
}
