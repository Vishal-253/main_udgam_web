import { useCallback, useEffect, useState } from "react";

const PASS_KEY = "udgam_event_pass";

/**
 * The visitor's event pass (ids of events they added), kept in localStorage.
 * Starts empty so the server render and hydration match, then loads the saved
 * pass on the client. Ids of events that no longer exist are dropped.
 */
export function useEventPass(validIds: readonly string[]) {
  const [pass, setPass] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(PASS_KEY) ?? "[]");
      if (Array.isArray(saved)) {
        setPass(
          saved.filter((id): id is string => typeof id === "string" && validIds.includes(id)),
        );
      }
    } catch {
      /* unreadable storage: start with an empty pass */
    }
    setLoaded(true);
    // validIds is the static event list; load once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(PASS_KEY, JSON.stringify(pass));
    } catch {
      /* storage unavailable: the pass just won't persist */
    }
  }, [pass, loaded]);

  const toggle = useCallback(
    (id: string) => setPass((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])),
    [],
  );
  const remove = useCallback((id: string) => setPass((p) => p.filter((x) => x !== id)), []);
  const clear = useCallback(() => setPass([]), []);

  return { pass, toggle, remove, clear };
}
