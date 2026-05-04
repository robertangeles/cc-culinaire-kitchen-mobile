/**
 * feedbackService — submits user feedback to the web backend.
 *
 * Flow (eng review 2026-05-04 finding 2.1):
 *
 *   FeedbackScreen
 *        │
 *        │ buildPayload({ subject, body, category,
 *        │               includeDiagnostics, screenshotBase64 })
 *        ▼
 *   feedbackPayload.buildPayload()
 *        │
 *        │ deviceInfo() if includeDiagnostics
 *        ▼
 *   feedbackService.submit(payload, { anon })
 *        │
 *        │ apiClient.post('/api/mobile/feedback', payload, {
 *        │   skipAuth: anon, signal: AbortController(10s),
 *        │ })
 *        ▼
 *   apiClient adds:
 *      • Authorization: Bearer ... (skipped when anon)
 *      • X-Mobile-App-Version: <native version>
 *      • Accept / Content-Type: application/json
 *        │
 *        ▼
 *   Server response → branching:
 *      • 201 → SubmitResult { id, created_dttm } → caller increments
 *              local AsyncStorage feedback.count.<owner>
 *      • 401 → apiClient refresh-then-retry → if refresh fails, AuthError
 *      • 403 → ApiError(403)        screen shows generic error
 *      • 426 → UpgradeRequiredError screen shows upgrade alert
 *      • 429 → ApiError(429, _, retryAfter) screen disables submit + countdown
 *      • 5xx → ApiError(5xx)        screen shows generic error
 *      • net → NetworkError         screen shows offline alert
 *      • 10s timeout → NetworkError (AbortController fires)
 *
 * Privacy invariant: this service does NOT send conversation content.
 * `body` is human prose typed by the user; the form copy explicitly
 * warns against pasting private chats. `device_info` is closed-shape
 * (zod-strict server-side) and only present when the user opted into
 * the diagnostic toggle. Screenshot is opt-in per-submission, base64
 * inline (no R2 in PR-A; v1.4+ migrates to object storage when volume
 * justifies).
 *
 * Web contract (verified 2026-05-04 in CEO plan v4):
 *   POST /api/mobile/feedback
 *     Auth: optional. Bearer present → user_id set. Bearer absent →
 *           user_id NULL, is_anonymous true (anon entry from Login).
 *     Headers: X-Mobile-App-Version (required by server middleware,
 *              enforced as 426 only on this endpoint for v1.3).
 *     Body: zod-strict (rejects unknown keys).
 *     Rate limit: 10/hour per user (auth); 3/hour per IP (anon).
 *     201: { id, created_dttm }
 *     400: { error } — zod validation
 *     426: { error: 'upgrade_required', minVersion }
 *     429: rate limited, includes Retry-After: <seconds>
 *     5xx: { error }
 *     Email send is ASYNC server-side (retry job). 201 returns once the
 *     PG insert succeeds — Resend send happens in background.
 */
import { apiClient } from '@/services/apiClient';

import { type FeedbackPayload } from './feedbackPayload';

export interface SubmitOptions {
  /**
   * When true, suppresses the Authorization header so the server
   * accepts the row as `user_id=NULL, is_anonymous=true`. Used by the
   * Login-screen entry point (per outside voice #7 + 2026-05-04 plan).
   */
  anon?: boolean;
  /**
   * Optional signal so the screen can cancel a submission (e.g. user
   * navigates away). Wraps a 10-second timeout via AbortController.
   */
  signal?: AbortSignal;
}

export interface SubmitResult {
  id: number;
  created_dttm: string;
}

/** 10 seconds — matches the eng review's request-timeout decision. */
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Submit a feedback payload. Resolves with `{ id, created_dttm }` on
 * success. Throws typed errors per the docstring's response branching.
 */
export async function submit(
  payload: FeedbackPayload,
  options: SubmitOptions = {},
): Promise<SubmitResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  // If the caller passed their own signal, abort the inner controller
  // when the outer signal fires too.
  const onCallerAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onCallerAbort);

  try {
    return await apiClient.post<SubmitResult>('/api/mobile/feedback', payload, {
      skipAuth: options.anon === true,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
    options.signal?.removeEventListener('abort', onCallerAbort);
  }
}
