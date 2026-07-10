"use client";

// Store externo mínimo com persistência em localStorage,
// para consumir via useSyncExternalStore. Vira camada de API
// quando o backend entrar.

export type LocalStore<T> = {
  subscribe: (fn: () => void) => () => void;
  get: () => T;
  getServer: () => T;
  set: (next: T) => void;
};

export function createLocalStore<T>(
  key: string,
  fallback: T,
  normalize?: (parsed: unknown) => T,
): LocalStore<T> {
  let cache: T | null = null;
  const listeners = new Set<() => void>();

  function load(): T {
    if (cache !== null) return cache;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        cache = normalize ? normalize(parsed) : (parsed as T);
        return cache;
      }
    } catch {
      // dados corrompidos ou storage indisponível: usa o fallback
    }
    cache = fallback;
    return cache;
  }

  return {
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    get: load,
    getServer: () => fallback,
    set(next) {
      cache = next;
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // storage cheio/indisponível: segue só em memória
      }
      listeners.forEach((fn) => fn());
    },
  };
}
