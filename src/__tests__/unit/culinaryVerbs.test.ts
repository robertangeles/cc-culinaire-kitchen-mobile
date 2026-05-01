/**
 * culinaryVerbs unit tests — invariants on the list itself.
 *
 * The hook that consumes this list (`useRotatingCulinaryVerb`) is
 * inline in `ChatList.tsx` and exercised manually on device. The
 * critical thing to lock in here is the data shape — if the list
 * shrinks below 78 or grows duplicates, the rotation degrades.
 */
import { CULINARY_VERBS } from '@/constants/culinaryVerbs';

describe('CULINARY_VERBS', () => {
  it('contains at least 78 verbs (the floor product spec calls for)', () => {
    expect(CULINARY_VERBS.length).toBeGreaterThanOrEqual(78);
  });

  it('contains no duplicate entries', () => {
    const set = new Set(CULINARY_VERBS);
    expect(set.size).toBe(CULINARY_VERBS.length);
  });

  it('has every entry in present-progressive (-ing) form', () => {
    const offenders = CULINARY_VERBS.filter((v) => !v.endsWith('ing'));
    expect(offenders).toEqual([]);
  });

  it('has every entry in sentence case — no caps, no leading/trailing whitespace', () => {
    const offenders = CULINARY_VERBS.filter((v) => v !== v.trim() || v !== v.toLowerCase());
    expect(offenders).toEqual([]);
  });

  it('has every entry length-bounded (3–24 chars) — guards typos and overlong phrases', () => {
    const offenders = CULINARY_VERBS.filter((v) => v.length < 3 || v.length > 24);
    expect(offenders).toEqual([]);
  });
});
