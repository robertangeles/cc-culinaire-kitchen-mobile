/**
 * Tests for modelDownloadService.
 *
 * Mocks the native BackgroundDownloadModule + NativeEventEmitter so we
 * can drive the JS orchestration deterministically (fire DownloadProgress
 * + DownloadComplete + DownloadError on demand) without touching the
 * Android worker, Room DB, or the network.
 */

import { MODEL } from '@/constants/config';

type Listener = (evt: unknown) => void;

const mockListeners = {
  DownloadProgress: new Set<Listener>(),
  DownloadComplete: new Set<Listener>(),
  DownloadError: new Set<Listener>(),
} as const;

const mockNative = {
  startDownload: jest.fn<Promise<string>, [unknown]>(),
  cancelDownload: jest.fn<Promise<boolean>, [string]>(),
  getActiveDownloads: jest.fn<Promise<unknown[]>, []>(),
  getDocumentDirectory: jest.fn<Promise<string>, []>(),
  addListener: jest.fn(),
  removeListeners: jest.fn(),
};

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  NativeModules: {
    get BackgroundDownloadModule() {
      return mockNative;
    },
  },
  NativeEventEmitter: jest.fn().mockImplementation(() => ({
    addListener: (event: string, listener: Listener) => {
      const set = mockListeners[event as keyof typeof mockListeners];
      set?.add(listener);
      return {
        remove: () => {
          set?.delete(listener);
        },
      };
    },
  })),
}));

const fireProgress = (evt: {
  downloadId: string;
  modelId: string;
  fileName: string;
  bytesDownloaded: number;
  totalBytes: number;
}) => {
  mockListeners.DownloadProgress.forEach((l) =>
    l({ ...evt, status: 'RUNNING', reasonCode: 'none' }),
  );
};

const fireComplete = (evt: {
  downloadId: string;
  modelId: string;
  fileName: string;
  totalBytes: number;
  destinationPath?: string;
}) => {
  mockListeners.DownloadComplete.forEach((l) =>
    l({ destinationPath: evt.destinationPath ?? '/data/test/' + evt.fileName, ...evt }),
  );
};

const fireError = (evt: {
  downloadId: string;
  modelId: string;
  fileName: string;
  reasonCode: string;
  message?: string;
}) => {
  mockListeners.DownloadError.forEach((l) => l({ message: evt.message ?? 'mock error', ...evt }));
};

const flushMicrotasks = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('modelDownloadService', () => {
  let service: typeof import('@/services/modelDownloadService');

  beforeEach(() => {
    jest.resetModules();
    Object.values(mockListeners).forEach((s) => s.clear());
    mockNative.startDownload.mockReset();
    mockNative.cancelDownload.mockReset().mockResolvedValue(true);
    mockNative.getActiveDownloads.mockReset().mockResolvedValue([]);
    mockNative.getDocumentDirectory.mockReset().mockResolvedValue('/data/test');
    let nextId = 0;
    mockNative.startDownload.mockImplementation(async () => {
      nextId += 1;
      return `dl-${nextId}`;
    });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    service = require('@/services/modelDownloadService');
    service.__forceError.value = false;
  });

  it('starts both files and reports weighted progress', async () => {
    const onProgress = jest.fn();
    const onDone = jest.fn();
    service.start({ onProgress, onDone });

    await flushMicrotasks();

    expect(mockNative.startDownload).toHaveBeenCalledTimes(2);
    const calls = mockNative.startDownload.mock.calls.map(
      ([params]) => params as Record<string, unknown>,
    );
    expect(calls.map((c) => c.fileName)).toEqual(
      expect.arrayContaining([MODEL.files.main.filename, MODEL.files.mmproj.filename]),
    );
    expect(calls.every((c) => c.subdirectory === `models/${MODEL.id}/v1`)).toBe(true);

    fireProgress({
      downloadId: 'dl-1',
      modelId: MODEL.id,
      fileName: MODEL.files.main.filename,
      bytesDownloaded: MODEL.files.main.sizeBytes / 2,
      totalBytes: MODEL.files.main.sizeBytes,
    });

    const lastFraction = onProgress.mock.calls.at(-1)?.[0] as number;
    const expected = MODEL.files.main.sizeBytes / 2 / MODEL.totalBytes;
    expect(lastFraction).toBeCloseTo(expected, 4);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('fires onDone only after BOTH files complete', async () => {
    const onProgress = jest.fn();
    const onDone = jest.fn();
    service.start({ onProgress, onDone });

    await flushMicrotasks();

    fireComplete({
      downloadId: 'dl-1',
      modelId: MODEL.id,
      fileName: MODEL.files.main.filename,
      totalBytes: MODEL.files.main.sizeBytes,
    });
    expect(onDone).not.toHaveBeenCalled();

    fireComplete({
      downloadId: 'dl-2',
      modelId: MODEL.id,
      fileName: MODEL.files.mmproj.filename,
      totalBytes: MODEL.files.mmproj.sizeBytes,
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('cancels both native downloads on handle.cancel', async () => {
    const handle = service.start({ onProgress: jest.fn(), onDone: jest.fn() });
    await flushMicrotasks();

    handle.cancel();
    await flushMicrotasks();

    expect(mockNative.cancelDownload).toHaveBeenCalledTimes(2);
    expect(mockNative.cancelDownload).toHaveBeenCalledWith('dl-1');
    expect(mockNative.cancelDownload).toHaveBeenCalledWith('dl-2');
  });

  it('double-cancel is safe', async () => {
    const handle = service.start({ onProgress: jest.fn(), onDone: jest.fn() });
    await flushMicrotasks();
    handle.cancel();
    expect(() => handle.cancel()).not.toThrow();
  });

  it('forwards a friendly message on DownloadError', async () => {
    const onError = jest.fn();
    service.start({ onProgress: jest.fn(), onDone: jest.fn(), onError });
    await flushMicrotasks();

    fireError({
      downloadId: 'dl-1',
      modelId: MODEL.id,
      fileName: MODEL.files.main.filename,
      reasonCode: 'disk_full',
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect((onError.mock.calls[0][0] as Error).message).toMatch(/free space/i);
  });

  it('adopts in-flight downloads from a previous launch (no duplicate start)', async () => {
    mockNative.getActiveDownloads.mockResolvedValueOnce([
      {
        downloadId: 'old-1',
        modelId: MODEL.id,
        fileName: MODEL.files.main.filename,
        url: MODEL.files.main.url,
        destinationPath: '/data/test/main',
        bytesDownloaded: MODEL.files.main.sizeBytes / 4,
        totalBytes: MODEL.files.main.sizeBytes,
        status: 'RUNNING',
        reasonCode: 'none',
      },
    ]);

    const onProgress = jest.fn();
    service.start({ onProgress, onDone: jest.fn() });
    await flushMicrotasks();

    expect(mockNative.startDownload).toHaveBeenCalledTimes(1);
    const startedFiles = mockNative.startDownload.mock.calls.map(
      ([p]) => (p as { fileName: string }).fileName,
    );
    expect(startedFiles).toEqual([MODEL.files.mmproj.filename]);

    const lastFraction = onProgress.mock.calls.at(-1)?.[0] as number;
    expect(lastFraction).toBeCloseTo(MODEL.files.main.sizeBytes / 4 / MODEL.totalBytes, 4);
  });

  it('calls onError when __forceError is set, without touching native', async () => {
    service.__forceError.value = true;
    const onError = jest.fn();
    const onProgress = jest.fn();
    const onDone = jest.fn();

    service.start({ onProgress, onDone, onError });
    await flushMicrotasks();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onProgress).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
    expect(mockNative.startDownload).not.toHaveBeenCalled();
  });
});
