"use client";

import { useState } from "react";
import { Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function SendReportButton() {
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/email/send-report", { method: "POST" });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success(`Reporte enviado a ${data.email}`);
      }
    } catch {
      toast.error("Error al enviar el reporte");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleSend}
      disabled={loading}
      title="Recibir reporte semanal ahora"
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-muted hover:text-primary hover:bg-primary/10 transition-all disabled:opacity-50 border border-border hover:border-primary/40"
    >
      {loading
        ? <Loader2 size={12} className="animate-spin" />
        : <Mail size={12} />
      }
      {loading ? "Enviando..." : "Enviar reporte"}
    </button>
  );
}
