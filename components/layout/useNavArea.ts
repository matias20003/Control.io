"use client";

import { useCallback, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AREAS, NAV_AREA_STORAGE_KEY, areaFromPath, type NavArea } from "@/lib/nav";

/**
 * El área elegida vive en localStorage, no en un estado de React: el sidebar y
 * la barra de abajo son dos componentes hermanos y tienen que coincidir. Se lee
 * con useSyncExternalStore para que el servidor renderice el default y el
 * cliente aplique lo guardado sin desajustar la hidratación.
 */
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => { listeners.delete(onChange); };
}

function readPreferred(): NavArea | null {
  try {
    const saved = window.localStorage.getItem(NAV_AREA_STORAGE_KEY);
    return saved === "finanzas" || saved === "organizacion" ? saved : null;
  } catch {
    // Safari en modo privado tira al leer localStorage. El default alcanza.
    return null;
  }
}

/** En el servidor no hay preferencia guardada: se resuelve al hidratar. */
const readServer = (): NavArea | null => null;

function writePreferred(area: NavArea) {
  try {
    window.localStorage.setItem(NAV_AREA_STORAGE_KEY, area);
  } catch {
    // Sin persistir se pierde entre recargas, pero el switch funciona igual.
  }
  for (const listener of listeners) listener();
}

/**
 * Qué área muestra el menú. El orden de decisión importa:
 *
 * 1. Si la ruta pertenece a un área, gana esa. Estando en Cuotas el switch no
 *    puede decir "Organización".
 * 2. Si la ruta es transversal (Inicio, Mi Brief, Configuración), vale lo último
 *    que el usuario eligió, para que el menú no vuelva solo a Finanzas.
 * 3. Sin nada guardado, Finanzas: sigue siendo con lo que casi todos entran.
 */
export function useNavArea() {
  const pathname = usePathname();
  const router = useRouter();
  const pathArea = areaFromPath(pathname);
  const preferred = useSyncExternalStore(subscribe, readPreferred, readServer);

  const area: NavArea = pathArea ?? preferred ?? "finanzas";

  const setArea = useCallback((next: NavArea) => {
    writePreferred(next);
    // Desde una sección del otro lado, quedarse sería confuso: el menú diría
    // Organización mientras la pantalla sigue mostrando Cuotas. Desde una
    // pantalla transversal no navegamos, así se puede mirar el menú sin salir.
    if (areaFromPath(pathname) && areaFromPath(pathname) !== next) {
      router.push(AREAS[next].home);
    }
  }, [pathname, router]);

  return { area, setArea };
}
