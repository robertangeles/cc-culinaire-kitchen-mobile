import { resolveRouteGuardRedirect, type RouteGuardState } from '@/navigation/routeGuard';

/**
 * CRITICAL regression coverage for the RouteGuard auth-state matrix.
 * Modifying RouteGuard changes existing auth behavior, so the kitchen
 * ack-bypass must be proven to relax ONLY food-safety, never auth (D3),
 * and to stay off when the build-gate is off (D4).
 */
const base: RouteGuardState = {
  segments: ['(tabs)', 'chat'],
  isHydrated: true,
  hasUser: true,
  emailVerified: true,
  ackRequired: false,
  kitchenEnabled: true,
};

describe('resolveRouteGuardRedirect', () => {
  it('stays put until hydrated', () => {
    expect(resolveRouteGuardRedirect({ ...base, isHydrated: false, hasUser: false })).toBeNull();
  });

  it('(legal) and (feedback) are reachable in any auth state', () => {
    expect(
      resolveRouteGuardRedirect({ ...base, segments: ['(legal)'], hasUser: false }),
    ).toBeNull();
    expect(
      resolveRouteGuardRedirect({ ...base, segments: ['(feedback)'], hasUser: false }),
    ).toBeNull();
  });

  describe('kitchen deep link preserves the auth gates', () => {
    const kitchen = ['(tabs)', 'kitchen', 'recipe-lab'];

    it('logged-out kitchen deep link → welcome (NOT the placeholder)', () => {
      expect(resolveRouteGuardRedirect({ ...base, segments: kitchen, hasUser: false })).toBe(
        '/(welcome)',
      );
    });

    it('unverified kitchen deep link → verify-email', () => {
      expect(resolveRouteGuardRedirect({ ...base, segments: kitchen, emailVerified: false })).toBe(
        '/(auth)/verify-email',
      );
    });

    it('verified + unacked → reaches the placeholder, food-safety bypassed', () => {
      expect(
        resolveRouteGuardRedirect({ ...base, segments: kitchen, ackRequired: true }),
      ).toBeNull();
    });

    it('[D4] bypass does NOT fire when KITCHEN_ENABLED is off → still gated by ack', () => {
      expect(
        resolveRouteGuardRedirect({
          ...base,
          segments: kitchen,
          ackRequired: true,
          kitchenEnabled: false,
        }),
      ).toBe('/(food-safety)');
    });
  });

  it('non-kitchen route still hits the food-safety ack gate', () => {
    expect(resolveRouteGuardRedirect({ ...base, ackRequired: true })).toBe('/(food-safety)');
  });

  it('fully past the gates on an onboarding group → chat', () => {
    expect(resolveRouteGuardRedirect({ ...base, segments: ['(welcome)'] })).toBe('/(tabs)/chat');
  });
});
