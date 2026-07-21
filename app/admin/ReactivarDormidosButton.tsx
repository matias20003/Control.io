"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle, Loader2 } from "lucide-react";

export function ReactivarDormidosButton() {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const run = async () => {
    setStatus("running");
    setMessage("");
    try {
      const res = await fetch("/api/admin/reactivar-dormidos-wa", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error desconocido");
      setStatus("done");
      setMessage(data.message);
    } catch (e: any) {
      setStatus("error");
      setMessage(e.message);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2 flex-shrink-0">
      <Button onClick={run} disabled={status === "running"} variant="outline" className="gap-2 text-xs">
        {status === "running"
          ? <><Loader2 size={13} className="animate-spin" />Enviando...</>
          : <><MessageCircle size={13} />Reactivar dormidos por WhatsApp</>}
      </Button>
      {message && (
        <p className={`text-xs ${status === "done" ? "text-success" : "text-danger"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
