/**
 * feedbackPayload — single source of truth for the wire-format payload
 * sent to `POST /api/mobile/feedback`.
 *
 * Same `buildPayload()` function feeds both:
 *   1. The diagnostic preview shown in the UI when the user toggles
 *      "Include diagnostic info" ON (so the preview cannot drift from
 *      what's actually sent).
 *   2. The HTTP POST body itself.
 *
 * Privacy invariant: device_info is null unless the user explicitly opts
 * in via the diagnostic toggle. Closed shape (see `deviceInfo.ts`).
 * `body` is human prose — the form copy includes a warning to NOT paste
 * conversation content.
 */
import { deviceInfo, type DeviceInfo } from './deviceInfo';

export type FeedbackCategory = 'bug' | 'feature' | 'feedback';

export interface BuildPayloadInput {
  subject: string;
  body: string;
  category: FeedbackCategory;
  includeDiagnostics: boolean;
  /** Optional photo as base64 data URL string (cap 500 KB after downscale). */
  screenshotBase64?: string | null;
}

export interface FeedbackPayload {
  subject: string;
  body: string;
  category: FeedbackCategory;
  device_info: DeviceInfo | null;
  screenshot_base64: string | null;
}

export function buildPayload(input: BuildPayloadInput): FeedbackPayload {
  return {
    subject: input.subject,
    body: input.body,
    category: input.category,
    device_info: input.includeDiagnostics ? deviceInfo() : null,
    screenshot_base64: input.screenshotBase64 ?? null,
  };
}
