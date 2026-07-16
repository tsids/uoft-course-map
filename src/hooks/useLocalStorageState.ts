import { useEffect, useRef, useState } from "react";

type Envelope = { value: unknown; savedAt: number };

function isEnvelope(value: unknown): value is Envelope {
  return (
    typeof value === "object" &&
    value !== null &&
    "value" in value &&
    "savedAt" in value &&
    typeof (value as Envelope).savedAt === "number"
  );
}

export function useLocalStorageState<T>(
  key: string,
  defaultValue: T,
  parse?: (stored: unknown) => T | null,
  ttlMs?: number,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const isFirstRun = useRef(true);

  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return defaultValue;
      const stored = JSON.parse(raw) as unknown;

      let candidate = stored;
      if (isEnvelope(stored)) {
        if (ttlMs && Date.now() - stored.savedAt > ttlMs) {
          localStorage.removeItem(key);
          return defaultValue;
        }
        candidate = stored.value;
      }

      if (parse) {
        const result = parse(candidate);
        return result ?? defaultValue;
      }
      return candidate as T;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    const payload: unknown = ttlMs ? ({ value, savedAt: Date.now() } satisfies Envelope) : value;
    localStorage.setItem(key, JSON.stringify(payload));
  }, [key, value, ttlMs]);

  return [value, setValue];
}
