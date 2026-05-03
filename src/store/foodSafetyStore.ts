/**
 * foodSafetyStore — per-session food-safety acknowledgement state.
 *
 * v1.2 design (post-test refinement):
 * The ack is reinforced on EVERY sign-in and EVERY cold launch — not
 * version-gated, not persisted. Reasoning: the food-safety / allergen /
 * medical / HACCP framing is the most legally consequential part of the
 * onboarding, and reinforcing it at every entry to chat is materially
 * stronger than a one-time tap-through under both Australian Consumer
 * Law and EU/UK consumer protection regimes. It also reminds the user,
 * each session, what Antoine is (a culinary assistant) and what he is
 * not (a food-safety system, a medical advisor, an allergen guarantor).
 *
 * Implementation:
 *   - `ackedThisSession` is in-memory only (no SecureStore).
 *   - Cold launch resets it (the JS module reloads → store reinitialises).
 *   - Sign-out resets it (authStore.signOut() calls `resetAck()`).
 *   - Sign-in always lands on the ack screen because the flag starts
 *     false — the route guard redirects until `acknowledge()` flips it.
 *   - Backgrounding the app does NOT reset (it's not a sign-in event);
 *     foregrounding skips the ack and resumes wherever the user was.
 *
 * The store is intentionally tiny — no SecureStore round-trip, no
 * version compare, no async hydration. Initial state is the answer.
 */
import { create } from 'zustand';

interface FoodSafetyStore {
  /**
   * True when the user has tapped "I understand" in this JS lifetime
   * AND not signed out since. False on every cold launch and after
   * every sign-out. Drives the route guard's ack-screen redirect.
   */
  ackedThisSession: boolean;

  /** Mark the ack tapped. Called by FoodSafetyAckScreen. */
  acknowledge: () => void;
  /** Reset the flag. Called by authStore.signOut. */
  resetAck: () => void;
}

export const useFoodSafetyStore = create<FoodSafetyStore>((set) => ({
  ackedThisSession: false,
  acknowledge: () => set({ ackedThisSession: true }),
  resetAck: () => set({ ackedThisSession: false }),
}));

/**
 * Pure selector: should the ack screen be shown right now? True when
 * the user has not yet acked in this session. Used by RouteGuard to
 * decide whether to redirect into the ack screen before letting the
 * user reach chat.
 */
export function isFoodSafetyAckRequired(state: { ackedThisSession: boolean }): boolean {
  return !state.ackedThisSession;
}
