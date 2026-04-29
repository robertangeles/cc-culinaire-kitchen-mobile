/**
 * TypeScript mirror of the Kotlin native module's API surface.
 *
 * Source of truth on the Kotlin side:
 *   plugins/withBackgroundDownload/android/src/DownloadStatus.kt
 *   plugins/withBackgroundDownload/android/src/BackgroundDownloadModule.kt
 *   plugins/withBackgroundDownload/android/src/DownloadEventBridge.kt
 *
 * Keep these enums in lockstep with DownloadStatus.kt and DownloadReason.kt.
 * If you add a new reason code on the Kotlin side, add it here too — the
 * JS-side error-message switch in modelDownloadService.ts depends on it.
 */

export type DownloadStatus = 'QUEUED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export type DownloadReasonCode =
  | 'none'
  | 'network_lost'
  | 'network_timeout'
  | 'server_unavailable'
  | 'download_interrupted'
  | 'disk_full'
  | 'file_corrupted'
  | 'empty_response'
  | 'user_cancelled'
  | 'http_401'
  | 'http_403'
  | 'http_404'
  | 'http_416'
  | 'client_error'
  | 'unknown_error';

export interface StartDownloadParams {
  url: string;
  fileName: string;
  modelId: string;
  /**
   * Relative subdirectory under the app's private files directory
   * (e.g. `models/antoine/v1`). Resolved on the native side against
   * `context.filesDir` so JS doesn't need the absolute path.
   */
  subdirectory?: string;
  totalBytes?: number;
  sha256?: string | null;
}

export interface DownloadProgressEvent {
  downloadId: string;
  modelId: string;
  fileName: string;
  bytesDownloaded: number;
  totalBytes: number;
  status: DownloadStatus;
  reasonCode: DownloadReasonCode;
}

export interface DownloadCompleteEvent {
  downloadId: string;
  modelId: string;
  fileName: string;
  destinationPath: string;
  totalBytes: number;
}

export interface DownloadErrorEvent {
  downloadId: string;
  modelId: string;
  fileName: string;
  reasonCode: DownloadReasonCode;
  message: string;
}

export interface ActiveDownload {
  downloadId: string;
  modelId: string;
  fileName: string;
  url: string;
  destinationPath: string;
  bytesDownloaded: number;
  totalBytes: number;
  status: DownloadStatus;
  reasonCode: DownloadReasonCode;
}

export interface BackgroundDownloadNativeModule {
  startDownload(params: StartDownloadParams): Promise<string>;
  cancelDownload(downloadId: string): Promise<boolean>;
  getActiveDownloads(): Promise<ActiveDownload[]>;
  getDocumentDirectory(): Promise<string>;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

/**
 * Maps a native reason code to a sentence the user can act on.
 * Voice: calm head chef. Short. No emoji. No "oops".
 */
export function reasonToMessage(reason: DownloadReasonCode): string {
  switch (reason) {
    case 'network_lost':
      return 'Waiting for connection. The download will resume automatically.';
    case 'network_timeout':
      return 'Connection timed out. Tap retry once you have a stronger signal.';
    case 'server_unavailable':
      return 'The model server is temporarily unavailable. Retrying.';
    case 'download_interrupted':
      return 'Download was interrupted. Tap retry to continue.';
    case 'disk_full':
      return 'Not enough free space on this device. Free up space and try again.';
    case 'file_corrupted':
      return 'Downloaded file failed integrity check. Tap retry to download again.';
    case 'empty_response':
      return 'The server returned an empty response. Tap retry.';
    case 'user_cancelled':
      return 'Download cancelled.';
    case 'http_401':
    case 'http_403':
      return 'Access to the model server was denied. Contact support.';
    case 'http_404':
      return 'The model file is no longer available at this URL.';
    case 'http_416':
      return 'Resume position is invalid. Restarting from the beginning.';
    case 'client_error':
      return 'The model server rejected the request. Tap retry.';
    case 'unknown_error':
    default:
      return 'Something went wrong. Tap retry.';
  }
}
