import { useCallback, useEffect, useState } from "react";

function readStoredPreference(storageKey: string, defaultOn: boolean): boolean {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored === null) return defaultOn;
    return stored !== "off";
  } catch {
    return defaultOn;
  }
}

/**
 * A boolean preference persisted to localStorage and shared across every
 * mounted consumer of the same `storageKey` (e.g. a toggle in a list toolbar
 * and a reader of it in a detail view opened at the same time).
 */
export function useLocalToggle(storageKey: string, defaultOn = true) {
  const eventName = `mealprep:localToggleChanged:${storageKey}`;
  const [value, setValueState] = useState<boolean>(() => readStoredPreference(storageKey, defaultOn));

  useEffect(() => {
    const handler = () => setValueState(readStoredPreference(storageKey, defaultOn));
    window.addEventListener("storage", handler);
    window.addEventListener(eventName, handler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener(eventName, handler);
    };
  }, [storageKey, defaultOn, eventName]);

  const toggle = useCallback(() => {
    setValueState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(storageKey, next ? "on" : "off");
      } catch {
        // ignore storage errors (private browsing, etc.)
      }
      window.dispatchEvent(new Event(eventName));
      return next;
    });
  }, [storageKey, eventName]);

  return [value, toggle] as const;
}
