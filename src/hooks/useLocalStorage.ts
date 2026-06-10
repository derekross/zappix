import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Generic hook for managing localStorage state
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  serializer?: {
    serialize: (value: T) => string;
    deserialize: (value: string) => T;
  }
) {
  const serialize = serializer?.serialize || JSON.stringify;
  const deserialize = serializer?.deserialize || JSON.parse;

  // Keep the (often inline, identity-unstable) serializer and default in refs
  // so callbacks and effects only need to depend on `key`
  const optionsRef = useRef({ serialize, deserialize, defaultValue });
  optionsRef.current = { serialize, deserialize, defaultValue };

  const readValue = useCallback((): T => {
    try {
      const item = localStorage.getItem(key);
      return item ? optionsRef.current.deserialize(item) : optionsRef.current.defaultValue;
    } catch (error) {
      console.warn(`Failed to load ${key} from localStorage:`, error);
      return optionsRef.current.defaultValue;
    }
  }, [key]);

  const [state, setState] = useState<T>(readValue);

  // Latest value, used so functional updates always see the current state
  // (even for multiple updates in the same tick)
  const stateRef = useRef(state);
  stateRef.current = state;

  // Re-initialize when the key changes (e.g. per-user keys after login) —
  // otherwise the old key's data lingers and the next write would store it
  // under the new key
  const prevKeyRef = useRef(key);
  useEffect(() => {
    if (prevKeyRef.current !== key) {
      prevKeyRef.current = key;
      const next = readValue();
      stateRef.current = next;
      setState(next);
    }
  }, [key, readValue]);

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(stateRef.current) : value;
      stateRef.current = valueToStore;
      setState(valueToStore);
      localStorage.setItem(key, optionsRef.current.serialize(valueToStore));
    } catch (error) {
      console.warn(`Failed to save ${key} to localStorage:`, error);
    }
  }, [key]);

  // Sync with localStorage changes from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          const next = optionsRef.current.deserialize(e.newValue);
          stateRef.current = next;
          setState(next);
        } catch (error) {
          console.warn(`Failed to sync ${key} from localStorage:`, error);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [key]);

  return [state, setValue] as const;
}
