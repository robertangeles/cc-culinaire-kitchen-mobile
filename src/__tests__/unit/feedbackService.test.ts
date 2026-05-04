/**
 * feedbackService unit tests.
 *
 * Mocks the apiClient.post call. Asserts that:
 *   - skipAuth flag is set correctly per anon flag
 *   - typed errors propagate to the caller
 *   - 10s AbortController timeout is wired (we trigger it manually)
 */
/* eslint-disable import/first */
jest.mock('@/services/apiClient', () => ({
  apiClient: { post: jest.fn() },
}));

import { ApiError, NetworkError, UpgradeRequiredError } from '@/services/__errors__';
import { apiClient } from '@/services/apiClient';
import type { FeedbackPayload } from '@/services/feedbackPayload';
import { submit } from '@/services/feedbackService';
/* eslint-enable import/first */

const mockPost = apiClient.post as jest.Mock;

const samplePayload: FeedbackPayload = {
  subject: 'Crash on send',
  body: 'Tap submit, app freezes.',
  category: 'bug',
  device_info: null,
  screenshot_base64: null,
};

describe('feedbackService.submit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('happy auth path: posts to /api/mobile/feedback with skipAuth=false', async () => {
    mockPost.mockResolvedValue({ id: 42, created_dttm: '2026-05-04T12:00:00Z' });
    const result = await submit(samplePayload);
    expect(mockPost).toHaveBeenCalledWith(
      '/api/mobile/feedback',
      samplePayload,
      expect.objectContaining({ skipAuth: false }),
    );
    expect(result).toEqual({ id: 42, created_dttm: '2026-05-04T12:00:00Z' });
  });

  it('anon path: posts with skipAuth=true (no Bearer header)', async () => {
    mockPost.mockResolvedValue({ id: 7, created_dttm: 'now' });
    await submit(samplePayload, { anon: true });
    expect(mockPost).toHaveBeenCalledWith(
      '/api/mobile/feedback',
      samplePayload,
      expect.objectContaining({ skipAuth: true }),
    );
  });

  it('threads an AbortSignal through to apiClient (for the 10s timeout)', async () => {
    mockPost.mockResolvedValue({ id: 1, created_dttm: 'now' });
    await submit(samplePayload);
    const opts = mockPost.mock.calls[0][2] as { signal: AbortSignal };
    expect(opts.signal).toBeDefined();
    expect(opts.signal).toBeInstanceOf(AbortSignal);
  });

  it('propagates UpgradeRequiredError from apiClient (426)', async () => {
    mockPost.mockRejectedValue(new UpgradeRequiredError('upgrade_required'));
    await expect(submit(samplePayload)).rejects.toBeInstanceOf(UpgradeRequiredError);
  });

  it('propagates ApiError(429) with retryAfter for the cooldown timer', async () => {
    mockPost.mockRejectedValue(new ApiError(429, 'rate_limited', 45));
    let caught: unknown;
    try {
      await submit(samplePayload);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).status).toBe(429);
    expect((caught as ApiError).retryAfter).toBe(45);
  });

  it('propagates NetworkError on a fetch failure', async () => {
    mockPost.mockRejectedValue(new NetworkError('offline'));
    await expect(submit(samplePayload)).rejects.toBeInstanceOf(NetworkError);
  });

  it('forwards ApiError(5xx) from server', async () => {
    mockPost.mockRejectedValue(new ApiError(503, 'service_unavailable'));
    await expect(submit(samplePayload)).rejects.toMatchObject({ status: 503 });
  });

  it('caller-supplied AbortSignal cancels the inner controller', async () => {
    // When the caller's signal aborts before the post settles, the
    // inner controller must abort too — apiClient sees AbortError.
    mockPost.mockImplementation(
      (_path: string, _body: unknown, opts: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          opts.signal.addEventListener('abort', () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }),
    );
    const ac = new AbortController();
    const p = submit(samplePayload, { signal: ac.signal });
    ac.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
  });
});
