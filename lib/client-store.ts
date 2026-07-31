"use client";

/**
 * Estado chico persistido en localStorage, leído con useSyncExternalStore.
 *
 * Por qué no useState + useEffect: leer localStorage en el primer render rompe
 * la hidratación (el server no lo tiene), y cargarlo desde un efecto dispara un
 * render en cascada. useSyncExternalStore resuelve las dos cosas: durante la
 * hidratación usa el snapshot del server y después sincroniza con el del cliente.
 */
import { useCallback, useSyncExternalStore } from "react";

type Listener = () => void;

const listeners = new Map<string, Set<Listener>>();
// Cachear el valor es obligatorio: getSnapshot tiene que devolver algo estable
// entre renders o React entra en un loop infinito de re-render.
const cache = new Map<string, string | null>();

function read(key: string): string | null {
  if (typeof window === "undefined") return null;
  if (!cache.has(key)) {
    try {
      cache.set(key, window.localStorage.getItem(key));
    } catch {
      cache.set(key, null);
    }
  }
  return cache.get(key) ?? null;
}

function subscribe(key: string, listener: Listener): () => void {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(listener);
  // Sincroniza entre pestañas abiertas.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== key) return;
    cache.delete(key);
    listeners.get(key)?.forEach((l) => l());
  };
  window.addEventListener("storage", onStorage);
  return () => {
    set?.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function writeLocal(key: string, value: string | null): void {
  cache.set(key, value);
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Modo incógnito o storage lleno: el valor sigue vivo en memoria.
  }
  listeners.get(key)?.forEach((l) => l());
}

/** Valor crudo (string) persistido bajo `key`. `null` = no seteado. */
export function useLocalValue(key: string): [string | null, (value: string | null) => void] {
  const value = useSyncExternalStore(
    useCallback((listener: Listener) => subscribe(key, listener), [key]),
    useCallback(() => read(key), [key]),
    () => null,
  );
  const set = useCallback((next: string | null) => writeLocal(key, next), [key]);
  return [value, set];
}
