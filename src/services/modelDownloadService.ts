/**
 * Model download service.
 *
 * v1: stub with `setInterval` ticker. Per eng review, the service exposes a
 * cancel() function that consumers MUST call from useEffect cleanup so the
 * timer doesn't leak when the screen unmounts mid-download.
 *
 * Real CDN download lands later (with checksum verification per CLAUDE.md
 * security § "GGUF file integrity verified via checksum after download").
 */

export interface DownloadHandle {
  cancel: () => void;
}

interface StartArgs {
  onProgress: (fraction: number) => void;
  onDone: () => void;
  onError?: (err: Error) => void;
  /** Override for tests so the ticker isn't real-time. Default 250ms. */
  intervalMs?: number;
  /** Override for tests so the increment is faster. Default 0.04 (~6s total). */
  step?: number;
}

export const __forceError = { value: false };

export function start({
  onProgress,
  onDone,
  onError,
  intervalMs = 250,
  step = 0.04,
}: StartArgs): DownloadHandle {
  let progress = 0;
  let done = false;
  let cancelled = false;

  if (__forceError.value) {
    setTimeout(() => {
      if (!cancelled && !done) {
        onError?.(new Error('Couldn’t reach the model CDN. Check your connection and retry.'));
      }
    }, intervalMs);
    return {
      cancel: () => {
        cancelled = true;
      },
    };
  }

  const tick = setInterval(() => {
    if (cancelled || done) return;
    progress = Math.min(1, progress + step);
    onProgress(progress);
    if (progress >= 1) {
      done = true;
      clearInterval(tick);
      onDone();
    }
  }, intervalMs);

  return {
    cancel: () => {
      if (done || cancelled) return;
      cancelled = true;
      clearInterval(tick);
    },
  };
}
