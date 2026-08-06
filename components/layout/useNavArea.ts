"use client";

import { usePathname } from "next/navigation";
import { areaFromPath, type NavArea } from "@/lib/nav";

/**
 * Qué pilar está desplegado en el menú: el de la ruta, y ninguno más.
 *
 * Antes esto guardaba el último pilar elegido en localStorage, y el efecto era
 * que Inicio abría siempre con Finanzas desplegado: una pantalla que habla de
 * los tres mostraba el menú de uno. Ahora el menú no recuerda nada — estando en
 * una pantalla transversal (Inicio, Configuración, Buscar) los tres pilares
 * quedan cerrados, que es lo que corresponde cuando ninguno es el tema.
 *
 * Como beneficio, desaparece el estado compartido entre componentes hermanos y
 * con él el desajuste de hidratación que obligaba a useSyncExternalStore.
 */
export function useNavArea(): { area: NavArea | null } {
  return { area: areaFromPath(usePathname()) };
}
