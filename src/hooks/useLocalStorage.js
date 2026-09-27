import { useState, useEffect } from "react";

/**
 * useState that persists to localStorage (JSON-encoded).
 * Falls back to the initial value when storage is unavailable or corrupt.
 */
export default function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage full or blocked — non-fatal */
    }
  }, [key, value]);

  return [value, setValue];
}
