"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2 } from "lucide-react";

export function ReactivationButton({ pending }: { pending: number }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const run = async () => {
    setStatus("running");
    setMessage("");
    try {
      const res = await fetch("/api/admin/send-reactivation", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error desconocido");
      setStatus("done");
      setMessage(data.message);
      // Refresca el panel para mover los usuarios a "enviados".
      router.refresh();
    } catch (e: any) {
      setStatus("error");
      setMessage(e.message);
    }
  };

  return (
    <div className="space-y-1.5">
      <button
        onClick={run}
        disabled={status === "running" || pending === 0}
        className="inline-flex items-center gap-1.5 rounded-lg bg-warning/15 px-3 py-1.5 text-xs font-semibold text-warning hover:bg-warning/25 transition-colors disabled:opacity-50"
      >
        {status === "running" ? (
          <><Loader2 size={13} className="animate-spin" /> Enviando...</>
        ) : (
          <><Send size={13} /> Enviar ahora ({pending})</>
        )}
      </button>
      {message && (
        <p className={`text-[11px] ${status === "done" ? "text-success" : "text-danger"}`}>{message}</p>
      )}
    </div>
  );
}
