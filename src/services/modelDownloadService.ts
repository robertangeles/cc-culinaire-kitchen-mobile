/**
 * Model download service.
 *
 * JS bridge to the Android native background download module
 * (`plugins/withBackgroundDownload`). Orchestrates the two GGUF files
 * Antoine needs (main + mmproj) as parallel native downloads,
 * aggregates their byte progress into a single 0..1 fraction weighted
 * by file size, and resolves `onDone` only when both finish.
 *
 * Public contract preserved from the v1 stub so that
 * `useModelDownload`, `DownloadingScreen`, and the existing tests
 * don't change shape:
 *
 *   start({ onProgress, onDone, onError }) -> { cancel }
 *
 * The `intervalMs` / `step` params are accepted but ignored — kept
 * for back-compat with the old stub tests, which now use the
 * NativeModules mock instead.
 *
 * Privacy invariant: only model file bytes flow through here. No
 * conversation content. Allowed CDN host is enforced on both sides
 * (JS pre-flight + Kotlin SSRF guard).
 */

import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

import { MODEL } from '@/constants/config';

import type {
  ActiveDownload,
  BackgroundDownloadNativeModule,
  DownloadCompleteEvent,
  DownloadErrorEvent,
  DownloadProgressEvent,
} from './types/backgroundDownload';
import { reasonToMessage } from './types/backgroundDownload';

export interface DownloadHandle {
  cancel: () => void;
}

interface StartArgs {
  onProgress: (fraction: number) => void;
  onDone: () => void;
  onError?: (err: Error) => void;
  /**
   * When true, the native WorkManager constraint is `UNMETERED` and
   * the worker waits for Wi-Fi. When false, any connected network is
   * acceptable (cellular included). Caller is the source of truth —
   * the service does NOT read it from the store directly to keep the
   * dependency direction service ← hook ← store.
   */
  wifiOnly?: boolean;
  /** Accepted for back-compat with the v1 stub tests; ignored. */
  intervalMs?: number;
  /** Accepted for back-compat with the v1 stub tests; ignored. */
  step?: number;
}

/**
 * Test escape hatch. When set to `true`, `start()` synchronously fires
 * onError on the next microtask without touching the native module.
 * Used by the auto-trigger first-launch flow's failure-path tests.
 */
export const __forceError = { value: false };

const MODEL_SUBDIRECTORY = `models/${MODEL.id}/v1`;

const FILES = [MODEL.files.main] as const;
const TOTAL_BYTES = FILES.reduce((sum, f) => sum + f.sizeBytes, 0);

function getNativeModule(): BackgroundDownloadNativeModule | null {
  const mod = (NativeModules as Record<string, unknown>).BackgroundDownloadModule;
  return (mod as BackgroundDownloadNativeModule | undefined) ?? null;
}

export function start({ onProgress, onDone, onError, wifiOnly = true }: StartArgs): DownloadHandle {
  let cancelled = false;
  let done = false;

  if (__forceError.value) {
    queueMicrotask(() => {
      if (!cancelled && !done) {
        onError?.(new Error('Couldn’t reach the model CDN. Check your connection and retry.'));
      }
    });
    return {
      cancel: () => {
        cancelled = true;
      },
    };
  }

  const native = getNativeModule();
  if (!native) {
    queueMicrotask(() => {
      if (!cancelled && !done) {
        const where = Platform.OS === 'android' ? 'native module not registered' : Platform.OS;
        onError?.(
          new Error(
            `Background download is only available in a custom dev client (got: ${where}). ` +
              'Run `pnpm android` to rebuild.',
          ),
        );
      }
    });
    return {
      cancel: () => {
        cancelled = true;
      },
    };
  }

  const emitter = new NativeEventEmitter(NativeModules.BackgroundDownloadModule);
  const bytesByDownloadId: Record<string, number> = {};
  const fileNameToId: Record<string, string> = {};
  const completed: Set<string> = new Set();
  const subs: { remove: () => void }[] = [];

  const finish = () => {
    if (done) return;
    done = true;
    subs.forEach((s) => s.remove());
    onDone();
  };

  const fail = (err: Error) => {
    if (done) return;
    done = true;
    subs.forEach((s) => s.remove());
    onError?.(err);
  };

  const reportProgress = () => {
    const totalDownloaded = Object.values(bytesByDownloadId).reduce((a, b) => a + b, 0);
    const fraction = TOTAL_BYTES > 0 ? Math.min(1, totalDownloaded / TOTAL_BYTES) : 0;
    onProgress(fraction);
  };

  subs.push(
    emitter.addListener('DownloadProgress', (evt: DownloadProgressEvent) => {
      if (cancelled || done) return;
      if (evt.modelId !== MODEL.id) return;
      bytesByDownloadId[evt.downloadId] = evt.bytesDownloaded;
      reportProgress();
    }),
  );

  subs.push(
    emitter.addListener('DownloadComplete', (evt: DownloadCompleteEvent) => {
      if (cancelled || done) return;
      if (evt.modelId !== MODEL.id) return;
      completed.add(evt.fileName);
      bytesByDownloadId[evt.downloadId] = evt.totalBytes;
      reportProgress();
      if (completed.size >= FILES.length) {
        finish();
      }
    }),
  );

  subs.push(
    emitter.addListener('DownloadError', (evt: DownloadErrorEvent) => {
      if (cancelled || done) return;
      if (evt.modelId !== MODEL.id) return;
      fail(new Error(reasonToMessage(evt.reasonCode)));
    }),
  );

  // Adopt any in-flight downloads from a previous app launch (the
  // user backgrounded mid-download, app got killed, JS just rebooted).
  // Without this, fresh JS would start a duplicate worker that the
  // de-dupe in BackgroundDownloadModule would refuse, leaving the bar
  // stuck at 0 with no events flowing. Seed bytes from Room state.
  native
    .getActiveDownloads()
    .then((rows: ActiveDownload[]) => {
      if (cancelled || done) return;
      for (const row of rows) {
        if (row.modelId !== MODEL.id) continue;
        bytesByDownloadId[row.downloadId] = row.bytesDownloaded;
        fileNameToId[row.fileName] = row.downloadId;
        if (row.status === 'COMPLETED') completed.add(row.fileName);
      }
      reportProgress();
      if (completed.size >= FILES.length) {
        finish();
        return;
      }
      // Start any missing files.
      Promise.all(
        FILES.filter((f) => !fileNameToId[f.filename] && !completed.has(f.filename)).map((f) =>
          native
            .startDownload({
              url: f.url,
              fileName: f.filename,
              modelId: MODEL.id,
              subdirectory: MODEL_SUBDIRECTORY,
              totalBytes: f.sizeBytes,
              sha256: f.sha256,
              wifiOnly,
            })
            .then((id) => {
              fileNameToId[f.filename] = id;
              return id;
            }),
        ),
      ).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        fail(new Error(`Couldn’t start the download. ${message}`));
      });
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      fail(new Error(`Couldn’t read in-flight downloads. ${message}`));
    });

  return {
    cancel: () => {
      if (done || cancelled) return;
      cancelled = true;
      subs.forEach((s) => s.remove());
      const ids = Object.values(fileNameToId);
      Promise.all(ids.map((id) => native.cancelDownload(id).catch(() => false))).catch(() => {
        // Best-effort: cancellation failures don't bubble to the user.
      });
    },
  };
}
