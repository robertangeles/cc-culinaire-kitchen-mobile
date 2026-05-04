/**
 * Integration test for the feedback submission service-layer end-to-end.
 *
 * Exercises the real wiring: form-level inputs → buildPayload() →
 * feedbackService.submit() → feedbackCount.incrementCount(). Stubs only
 * the apiClient HTTP boundary (so we don't hit the network) and uses
 * the real AsyncStorage jest mock.
 *
 * Screen-level rendering is validated manually on the Moto G86 Power
 * per the eng-review test plan artifact.
 */
/* eslint-disable import/first, @typescript-eslint/no-require-imports */
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/services/apiClient', () => ({
  apiClient: { post: jest.fn() },
}));
jest.mock('@/services/deviceInfo', () => ({
  deviceInfo: jest.fn(() => ({
    app_version: '1.3.0',
    device_model: 'Moto G86 Power',
    os_name: 'android',
    os_version: '34',
    locale: 'en-US',
  })),
}));

import { ApiError, NetworkError } from '@/services/__errors__';
import { apiClient } from '@/services/apiClient';
import { getCount, incrementCount } from '@/services/feedbackCount';
import { buildPayload } from '@/services/feedbackPayload';
import { submit } from '@/services/feedbackService';
/* eslint-enable import/first, @typescript-eslint/no-require-imports */

const mockPost = apiClient.post as jest.Mock;

describe('feedback submission — end-to-end (service layer)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('auth submission: payload built, posted authed, counter incremented', async () => {
    mockPost.mockResolvedValue({ id: 1, created_dttm: '2026-05-04T12:00:00Z' });

    const payload = buildPayload({
      subject: 'Crash on send',
      body: 'App freezes when I tap submit.',
      category: 'bug',
      includeDiagnostics: true,
    });

    const result = await submit(payload);
    await incrementCount(42);

    expect(result.id).toBe(1);
    expect(mockPost).toHaveBeenCalledWith(
      '/api/mobile/feedback',
      expect.objectContaining({
        subject: 'Crash on send',
        body: 'App freezes when I tap submit.',
        category: 'bug',
        device_info: expect.objectContaining({ app_version: '1.3.0' }),
      }),
      expect.objectContaining({ skipAuth: false }),
    );
    expect(await getCount(42)).toBe(1);
  });

  it('anon submission: skipAuth=true, separate counter namespace', async () => {
    mockPost.mockResolvedValue({ id: 2, created_dttm: 'now' });

    const payload = buildPayload({
      subject: "Can't sign in",
      body: 'Google button does nothing.',
      category: 'bug',
      includeDiagnostics: false,
    });
    await submit(payload, { anon: true });
    await incrementCount('anon');

    expect(mockPost).toHaveBeenCalledWith(
      '/api/mobile/feedback',
      expect.objectContaining({ device_info: null }),
      expect.objectContaining({ skipAuth: true }),
    );
    expect(await getCount('anon')).toBe(1);
    expect(await getCount(42)).toBe(0); // auth namespace untouched
  });

  it('429 leaves the local counter untouched', async () => {
    mockPost.mockRejectedValue(new ApiError(429, 'rate_limited', 30));

    const payload = buildPayload({
      subject: 'Test',
      body: 'Test',
      category: 'feedback',
      includeDiagnostics: false,
    });

    let caught: unknown;
    try {
      await submit(payload);
    } catch (e) {
      caught = e;
    }
    expect((caught as ApiError).retryAfter).toBe(30);
    expect(await getCount(42)).toBe(0);
  });

  it('network error leaves the local counter untouched', async () => {
    mockPost.mockRejectedValue(new NetworkError('offline'));

    const payload = buildPayload({
      subject: 'Test',
      body: 'Test',
      category: 'feedback',
      includeDiagnostics: false,
    });

    await expect(submit(payload)).rejects.toBeInstanceOf(NetworkError);
    expect(await getCount(42)).toBe(0);
  });

  it('multiple successful submissions accumulate the counter', async () => {
    mockPost.mockResolvedValue({ id: 1, created_dttm: 'now' });

    for (let i = 0; i < 3; i++) {
      const payload = buildPayload({
        subject: `Report ${i}`,
        body: 'Body',
        category: 'feedback',
        includeDiagnostics: false,
      });
      await submit(payload);
      await incrementCount(42);
    }
    expect(await getCount(42)).toBe(3);
  });
});
