/**
 * feedbackCount — small AsyncStorage-backed counter for the
 * "{n} SENT" copper badge on the Settings row.
 *
 * Per-install, namespaced by user_id (or `'anon'` for unauth submissions).
 * Cross-account leak guard (eng review finding 1.2): keys are explicitly
 * cleared in `authStore.signOut()`. NOT a SecureStore namespace sweep —
 * each key removal is wired explicitly.
 *
 * Known limitation: under-counts when a successful POST gets a dropped
 * 200 response (we increment on resolve only). Acceptable for v1.3 MVP;
 * v1.4+ adds server-authoritative `GET /api/mobile/feedback/count`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const FEEDBACK_COUNT_KEY_PREFIX = 'feedback.count.';

/**
 * Build the AsyncStorage key for a given owner. Pass a numeric/string
 * user_id for authenticated users, or the literal string `'anon'` for
 * unauth (Login-screen entry) submissions.
 */
export function feedbackCountKey(owner: string | number): string {
  return `${FEEDBACK_COUNT_KEY_PREFIX}${owner}`;
}

export async function getCount(owner: string | number): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(feedbackCountKey(owner));
    if (raw === null) return 0;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

export async function incrementCount(owner: string | number): Promise<number> {
  const current = await getCount(owner);
  const next = current + 1;
  await AsyncStorage.setItem(feedbackCountKey(owner), String(next));
  return next;
}

/**
 * Clear the counter for a specific owner. Called by `authStore.signOut()`
 * for both the signed-out user_id AND the `'anon'` namespace, so a
 * subsequent user signing in on the same device starts at 0.
 */
export async function clearCount(owner: string | number): Promise<void> {
  await AsyncStorage.removeItem(feedbackCountKey(owner));
}
