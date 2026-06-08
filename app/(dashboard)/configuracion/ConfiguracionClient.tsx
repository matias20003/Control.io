"use client";

import { useState } from "react";
import { Tag, User } from "lucide-react";
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
  const [tab, setTab] = useState<Tab>("categorias");

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configuración</h1>
        <p className="text-sm text-muted mt-0.5">Personalizá categorías y tu perfil</p>
      </div>

      <div className="flex gap-1 bg-surface-2 rounded-xl p-1 w-fit">
        {(
          [
            { id: "categorias", label: "Categorías", icon: Tag },
            { id: "perfil", label: "Perfil", icon: User },
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
        />
      )}
    </div>
  );
}
