"use client";

import { useEffect, useRef, useState } from "react";

/**
 * State backed by a load/save pair. Solves the SSR-hydration race:
 *   - On mount, we set state from `load()`. Before this fires the value is
 *     whatever `initial()` returned (typically the empty/seed value).
 *   - We DO NOT save on the first render — that would overwrite the stored
 *     value with the seed before hydration lands.
 *
 * Returns the current value, a setter, and a boolean indicating whether the
 * load has run yet (useful for skipping work that depends on real data).
 */
export function useHydratedStore<T>(
  initial: () => T,
  load: () => T,
  save: (value: T) => void,
): [T, (next: T | ((prev: T) => T)) => void, boolean] {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);
  const skipSaveRef = useRef(true);

  // Hydrate from storage exactly once.
  useEffect(() => {
    setValue(load());
    setHydrated(true);
    // Allow saves on subsequent updates.
    skipSaveRef.current = false;
    // Intentionally empty deps — load is captured by closure on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save on changes, but skip the very first one (the initial commit).
  useEffect(() => {
    if (skipSaveRef.current) return;
    save(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return [value, setValue, hydrated];
}
