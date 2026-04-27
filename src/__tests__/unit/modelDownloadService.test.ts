import { __forceError, start } from '@/services/modelDownloadService';

describe('modelDownloadService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    __forceError.value = false;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reports progress 0 → 1 and calls onDone', () => {
    const onProgress = jest.fn();
    const onDone = jest.fn();
    const handle = start({ onProgress, onDone, intervalMs: 100, step: 0.25 });
    jest.advanceTimersByTime(500);
    expect(onProgress).toHaveBeenCalledWith(0.25);
    expect(onProgress).toHaveBeenLastCalledWith(1);
    expect(onDone).toHaveBeenCalledTimes(1);
    handle.cancel();
  });

  it('cancel stops the timer mid-flight', () => {
    const onProgress = jest.fn();
    const onDone = jest.fn();
    const handle = start({ onProgress, onDone, intervalMs: 100, step: 0.25 });
    jest.advanceTimersByTime(150);
    handle.cancel();
    jest.advanceTimersByTime(1000);
    expect(onDone).not.toHaveBeenCalled();
    const callsAtCancel = onProgress.mock.calls.length;
    expect(onProgress.mock.calls.length).toBe(callsAtCancel);
  });

  it('double-cancel is safe', () => {
    const onProgress = jest.fn();
    const onDone = jest.fn();
    const handle = start({ onProgress, onDone, intervalMs: 100, step: 0.25 });
    jest.advanceTimersByTime(100);
    handle.cancel();
    expect(() => handle.cancel()).not.toThrow();
  });

  it('calls onError when __forceError is set', () => {
    __forceError.value = true;
    const onProgress = jest.fn();
    const onDone = jest.fn();
    const onError = jest.fn();
    start({ onProgress, onDone, onError, intervalMs: 50 });
    jest.advanceTimersByTime(60);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onProgress).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });
});
