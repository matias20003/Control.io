"use client";

import { useState } from "react";
import { Tag, User, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CategoriasTab } from "./CategoriasTab";
import { ProfileTab } from "./ProfileTab";
import type { SerializedCategory } from "@/lib/db/categories";

type Tab = "categorias" | "perfil";

interface Props {
  initialCategories: SerializedCategory[];
  profileName: string | null;
  profileEmail: string;
  mfaEnabled: boolean;
  recoveryCodesRemaining: number;
  whatsappNumber: string | null;
}

export function ConfiguracionClient({
  initialCategories,
  profileName,
  profileEmail,
  mfaEnabled,
  recoveryCodesRemaining,
  whatsappNumber,
}: Props) {
  const [tab, setTab] = useState<Tab>("perfil");
  const [query, setQuery] = useState("");

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configuración</h1>
        <p className="text-sm text-muted mt-0.5">Personalizá categorías y tu perfil</p>
      </div>

      {/* Buscador de configuraciones */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
        <Input
          type="search"
          inputMode="search"
          placeholder="Buscar una configuración…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value) setTab("perfil");
          }}
          className="pl-9 pr-9"
          aria-label="Buscar configuración"
        />
        {query && (
          <button
            type="button"
            aria-label="Limpiar búsqueda"
            onClick={() => setQuery("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted hover:text-foreground hover:bg-surface-2"
          >
            <X size={15} />
          </button>
        )}
      </div>

      <div className="flex gap-1 bg-surface-2 rounded-xl p-1 w-fit">
        {(
          [
            { id: "perfil", label: "Perfil", icon: User },
            { id: "categorias", label: "Categorías", icon: Tag },
          ] as { id: Tab; label: string; icon: React.ElementType }[]
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === id ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {tab === "categorias" && <CategoriasTab initialCategories={initialCategories} />}

      {tab === "perfil" && (
        <ProfileTab
          profileName={profileName}
          profileEmail={profileEmail}
          mfaEnabled={mfaEnabled}
          recoveryCodesRemaining={recoveryCodesRemaining}
          whatsappNumber={whatsappNumber}
          query={query}
        />
      )}
    </div>
  );
}
