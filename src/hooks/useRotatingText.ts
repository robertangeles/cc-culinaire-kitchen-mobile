import { useEffect, useState } from 'react';

/**
 * Cycles through a list of strings with a fixed cadence. Returns the
 * current item AND its index (callers can use index for keyed re-mounts
 * to drive cross-fade animations via Animated/Reanimated).
 *
 * Used by DownloadingScreen (rotating culinary tips) and ChatGreeting
 * (rotating multilingual "Hello"). Identical mechanics, single hook.
 *
 * Cleanup: clears the interval on unmount and on items/cadence changes
 * — no leaked timers when the screen unmounts mid-cycle.
 */
export function useRotatingText<T>(
  items: readonly T[],
  cadenceMs: number,
): {
  value: T;
  index: number;
} {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % items.length);
    }, cadenceMs);
    return () => clearInterval(id);
  }, [items.length, cadenceMs]);

  return { value: items[index] as T, index };
}
