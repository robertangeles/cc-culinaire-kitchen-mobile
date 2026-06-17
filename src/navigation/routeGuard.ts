/**
 * Pure routing-gate decision, extracted from the RouteGuard effect in
 * `app/_layout.tsx` so the auth/onboarding/kitchen matrix is unit-testable
 * without rendering the layout. Returns the href to `router.replace()` to,
 * or `null` to stay put.
 *
 * Order matters — it encodes the gate precedence:
 *
 *   not hydrated ─────────────────────────────────▶ stay (null)
 *   (legal) / (feedback) ─────────────────────────▶ stay (any auth state)
 *   no user ──────────────────────────────────────▶ (welcome) unless in auth flow
 *   unverified email ─────────────────────────────▶ (auth)/verify-email
 *   [D3/D4] (tabs)/kitchen + KITCHEN_ENABLED ─────▶ stay (skip ONLY food-safety)
 *   ack required ─────────────────────────────────▶ (food-safety)
 *   on an onboarding/auth group, fully past gates ─▶ (tabs)/chat
 *   otherwise ────────────────────────────────────▶ stay
 *
 * The kitchen bypass sits AFTER auth + email-verify (so a logged-out deep
 * link still goes to welcome) and BEFORE the ack check (placeholders carry
 * no Antoine content, so they don't need the food-safety acknowledgement).
 * It is gated on `kitchenEnabled` so a store-review build never opens a
 * food-safety hole for routes it is also redirecting away (D4).
 */
export interface RouteGuardState {
  segments: string[];
  isHydrated: boolean;
  hasUser: boolean;
  emailVerified: boolean;
  ackRequired: boolean;
  kitchenEnabled: boolean;
}

const WELCOME = '/(welcome)';
const VERIFY_EMAIL = '/(auth)/verify-email';
const FOOD_SAFETY = '/(food-safety)';
const CHAT = '/(tabs)/chat';

export function resolveRouteGuardRedirect(state: RouteGuardState): string | null {
  const { segments, isHydrated, hasUser, emailVerified, ackRequired, kitchenEnabled } = state;

  if (!isHydrated) return null;

  // (legal) + (feedback) are reachable in every auth state — short-circuit
  // before any redirect.
  if (segments[0] === '(legal)') return null;
  if (segments[0] === '(feedback)') return null;

  const inAuthFlow =
    segments[0] === '(welcome)' || segments[0] === '(auth)' || segments[0] === '(onboarding)';
  const onFoodSafety = segments[0] === '(food-safety)';
  const onVerifyEmail = segments[0] === '(auth)' && segments[1] === 'verify-email';

  if (!hasUser) {
    return inAuthFlow ? null : WELCOME;
  }

  if (!emailVerified) {
    return onVerifyEmail ? null : VERIFY_EMAIL;
  }

  // [D3/D4] Kitchen ack-bypass — placed AFTER auth + email-verify, BEFORE the
  // ack check. Only when the build-gate is on.
  if (kitchenEnabled && segments[0] === '(tabs)' && segments[1] === 'kitchen') {
    return null;
  }

  if (ackRequired) {
    return onFoodSafety ? null : FOOD_SAFETY;
  }

  if (
    segments[0] === '(welcome)' ||
    segments[0] === '(auth)' ||
    segments[0] === '(food-safety)' ||
    segments[0] === '(onboarding)' ||
    segments[0] === '(downloading)'
  ) {
    return CHAT;
  }

  return null;
}
