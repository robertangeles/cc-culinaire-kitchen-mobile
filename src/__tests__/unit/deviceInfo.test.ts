/**
 * deviceInfo memoization + closed-shape assertions.
 *
 * The shape is intentionally CLOSED (zod-strict server-side rejects
 * unknown keys). This test acts as a tripwire: any new field added
 * here without a corresponding privacy review + server-side schema
 * update will fail.
 */
import { __resetDeviceInfoForTests, deviceInfo } from '@/services/deviceInfo';

jest.mock('expo-application', () => ({
  nativeApplicationVersion: '1.3.0',
}));
jest.mock('expo-device', () => ({
  modelName: 'Moto G86 Power',
}));
jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageTag: 'en-US' }]),
}));

describe('deviceInfo', () => {
  beforeEach(() => {
    __resetDeviceInfoForTests();
  });

  it('returns the closed shape with all expected fields', () => {
    const info = deviceInfo();
    expect(info).toEqual({
      app_version: '1.3.0',
      device_model: 'Moto G86 Power',
      os_name: expect.any(String),
      os_version: expect.any(String),
      locale: 'en-US',
    });
  });

  it('memoizes the result — second call returns the same object', () => {
    const a = deviceInfo();
    const b = deviceInfo();
    expect(a).toBe(b);
  });

  it('does NOT include forbidden fields (privacy invariant tripwire)', () => {
    const info = deviceInfo() as unknown as Record<string, unknown>;
    expect(info).not.toHaveProperty('ip');
    expect(info).not.toHaveProperty('user_agent');
    expect(info).not.toHaveProperty('userAgent');
    expect(info).not.toHaveProperty('mac');
    expect(info).not.toHaveProperty('advertising_id');
    expect(info).not.toHaveProperty('adid');
    expect(Object.keys(info).sort()).toEqual(
      ['app_version', 'device_model', 'locale', 'os_name', 'os_version'].sort(),
    );
  });
});
