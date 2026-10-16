import { useCallback, useEffect, useState } from "react";

// Events this browser has registered for: { eventId: registrationId }. Only used to show
// "Registered" on the button and reopen the receipt — the backend is the real record.
const KEY = "udgam_registrations_v1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useRegistrations(validIds: readonly string[]) {
  const [registered, setRegistered] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? "{}");
      if (saved && typeof saved === "object") {
        const clean: Record<string, string> = {};
        for (const [eventId, regId] of Object.entries(saved as Record<string, unknown>)) {
          if (validIds.includes(eventId) && typeof regId === "string" && UUID.test(regId)) {
            clean[eventId] = regId;
          }
        }
        setRegistered(clean);
      }
    } catch {
      /* unreadable storage: start empty */
    }
    setLoaded(true);
    // validIds is the static event list; load once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(registered));
    } catch {
      /* storage unavailable: just won't persist */
    }
  }, [registered, loaded]);

  const record = useCallback(
    (eventId: string, registrationId: string) =>
      setRegistered((r) => ({ ...r, [eventId]: registrationId })),
    [],
  );

  return { registered, record };
}
