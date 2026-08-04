"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { NOTICE_BODY, NOTICE_ICON, NOTICE_ROW, NOTICE_TITLE } from "@/components/notice";

/**
 * Presenta Gastos hormiga una única vez y después se calla.
 *
 * La sección ya vive como pestaña dentro de Análisis; este aviso existe nada
 * más para que el usuario se entere de que está. Una vez que lo vio, insistir
 * es ruido en la primera pantalla.
 *
 * Se marca como visto al mostrarlo, no al clickearlo: el objetivo es enterarse,
 * y si además entra, mejor.
 */
const KEY = "control:ant-expenses-seen";

export function AntExpensesNotice() {
  // Arranca oculto y aparece recién cuando el efecto confirmó que no se vio
  // antes: pintarlo primero y esconderlo después haría un parpadeo en cada
  // carga del dashboard para alguien que ya lo descartó.
  const [show, setShow] = useState(false);

  useEffect(() => {
    let seen = false;
    try { seen = localStorage.getItem(KEY) === "1"; } catch {}
    if (seen) return;
    try { localStorage.setItem(KEY, "1"); } catch {}
    setShow(true);
  }, []);

  if (!show) return null;

  return (
    <Link href="/gastos-hormiga" className={`${NOTICE_ROW} transition-colors hover:bg-surface-2`}>
      <span className={`${NOTICE_ICON} bg-warning/12 text-base`}>🐜</span>
      <div className="min-w-0 flex-1">
        <p className={NOTICE_TITLE}>Gastos hormiga</p>
        <p className={NOTICE_BODY}>
          Descubrí dónde se te va la plata. Después lo encontrás en Análisis.
        </p>
      </div>
      <ChevronRight size={16} className="shrink-0 text-muted" />
    </Link>
  );
}
