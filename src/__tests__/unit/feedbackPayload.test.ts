import { buildPayload } from '@/services/feedbackPayload';

jest.mock('@/services/deviceInfo', () => ({
  deviceInfo: jest.fn(() => ({
    app_version: '1.3.0',
    device_model: 'Moto G86 Power',
    os_name: 'android',
    os_version: '34',
    locale: 'en-US',
  })),
}));

describe('feedbackPayload.buildPayload', () => {
  const baseInput = {
    subject: 'Quick subject',
    body: 'Hello there',
    category: 'bug' as const,
    includeDiagnostics: false,
  };

  it('includes core fields at all times', () => {
    const p = buildPayload(baseInput);
    expect(p.subject).toBe('Quick subject');
    expect(p.body).toBe('Hello there');
    expect(p.category).toBe('bug');
  });

  it('omits device_info when includeDiagnostics is false', () => {
    expect(buildPayload(baseInput).device_info).toBeNull();
  });

  it('embeds device_info when includeDiagnostics is true', () => {
    const p = buildPayload({ ...baseInput, includeDiagnostics: true });
    expect(p.device_info).toEqual({
      app_version: '1.3.0',
      device_model: 'Moto G86 Power',
      os_name: 'android',
      os_version: '34',
      locale: 'en-US',
    });
  });

  it('omits screenshot when not provided', () => {
    expect(buildPayload(baseInput).screenshot_base64).toBeNull();
  });

  it('passes screenshotBase64 through verbatim', () => {
    const p = buildPayload({ ...baseInput, screenshotBase64: 'aGVsbG8=' });
    expect(p.screenshot_base64).toBe('aGVsbG8=');
  });

  it('produces stable JSON shape for the diagnostic preview', () => {
    const json = JSON.stringify(buildPayload({ ...baseInput, includeDiagnostics: true }));
    // Stable key set — defensive against accidental drift between
    // preview rendering and POST body.
    const parsed = JSON.parse(json);
    expect(Object.keys(parsed).sort()).toEqual(
      ['body', 'category', 'device_info', 'screenshot_base64', 'subject'].sort(),
    );
  });
});
