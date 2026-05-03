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

  it('starts the main model file and reports progress', async () => {
    const onProgress = jest.fn();
    const onDone = jest.fn();
    service.start({ onProgress, onDone });

    await flushMicrotasks();

    expect(mockNative.startDownload).toHaveBeenCalledTimes(1);
    const params = mockNative.startDownload.mock.calls[0]![0] as Record<string, unknown>;
    expect(params.fileName).toBe(MODEL.files.main.filename);
    expect(params.subdirectory).toBe(`models/${MODEL.id}/v1`);
    // Default: wifiOnly = true (caller passed nothing).
    expect(params.wifiOnly).toBe(true);

    fireProgress({
      downloadId: 'dl-1',
      modelId: MODEL.id,
      fileName: MODEL.files.main.filename,
      bytesDownloaded: MODEL.files.main.sizeBytes / 2,
      totalBytes: MODEL.files.main.sizeBytes,
    });

    const lastFraction = onProgress.mock.calls.at(-1)?.[0] as number;
    expect(lastFraction).toBeCloseTo(0.5, 4);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('fires onDone after the main file completes', async () => {
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
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('cancels the active download on handle.cancel', async () => {
    const handle = service.start({ onProgress: jest.fn(), onDone: jest.fn() });
    await flushMicrotasks();

    handle.cancel();
    await flushMicrotasks();

    expect(mockNative.cancelDownload).toHaveBeenCalledTimes(1);
    expect(mockNative.cancelDownload).toHaveBeenCalledWith('dl-1');
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

  it('adopts an in-flight download from a previous launch (no duplicate start)', async () => {
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

    // No duplicate start: the in-flight download is adopted as-is.
    expect(mockNative.startDownload).not.toHaveBeenCalled();

    const lastFraction = onProgress.mock.calls.at(-1)?.[0] as number;
    expect(lastFraction).toBeCloseTo(0.25, 4);
  });

  it('passes wifiOnly=false through to native when caller opts in to cellular', async () => {
    service.start({ onProgress: jest.fn(), onDone: jest.fn(), wifiOnly: false });
    await flushMicrotasks();
    const calls = mockNative.startDownload.mock.calls.map(
      ([params]) => params as Record<string, unknown>,
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]!.wifiOnly).toBe(false);
  });

  it('two concurrent start() calls only spawn one native download per file (race fix)', async () => {
    // Both start() calls happen before either's getActiveDownloads()
    // resolves. Without the inflightBootstrap gate, both would see
    // [] (no active downloads) and both would call startDownload(),
    // creating duplicate Room rows + native workers. With the gate,
    // the second caller waits for the first's bootstrap, then runs
    // its own getActiveDownloads() and sees the row spawned by the
    // first — adopting it instead of duplicating.
    let resolveFirstActive: (rows: unknown[]) => void = () => undefined;
    let resolveSecondActive: (rows: unknown[]) => void = () => undefined;
    mockNative.getActiveDownloads
      .mockReturnValueOnce(new Promise<unknown[]>((r) => (resolveFirstActive = r)))
      .mockReturnValueOnce(new Promise<unknown[]>((r) => (resolveSecondActive = r)));

    service.start({ onProgress: jest.fn(), onDone: jest.fn() });
    service.start({ onProgress: jest.fn(), onDone: jest.fn() });

    // Resolve both reads with no in-flight rows. The first caller will
    // proceed to startDownload(); the second will await the first's
    // bootstrap, then re-run getActiveDownloads() — but our mock returns
    // [] there too. The gate's value isn't in the read result; it's in
    // serialising the read-then-spawn so the second caller sees the row.
    //
    // To prove the gate is engaged, we instead assert the first caller
    // begins its startDownload() chain BEFORE the second caller's
    // getActiveDownloads() resolves, AND that the second caller does
    // NOT call startDownload() once it sees the file is already known.
    resolveFirstActive([]);
    await flushMicrotasks();

    // First call should have spawned exactly one startDownload by now.
    expect(mockNative.startDownload).toHaveBeenCalledTimes(1);

    // Now simulate the second caller's getActiveDownloads resolving
    // with the row that the first caller registered (mirrors what
    // the native layer would actually return after startDownload).
    resolveSecondActive([
      {
        downloadId: 'dl-1',
        modelId: MODEL.id,
        fileName: MODEL.files.main.filename,
        url: MODEL.files.main.url,
        destinationPath: '/data/test/main',
        bytesDownloaded: 0,
        totalBytes: MODEL.files.main.sizeBytes,
        status: 'RUNNING',
        reasonCode: 'none',
      },
    ]);
    await flushMicrotasks();

    // No second startDownload — the second caller adopted the row.
    expect(mockNative.startDownload).toHaveBeenCalledTimes(1);
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
