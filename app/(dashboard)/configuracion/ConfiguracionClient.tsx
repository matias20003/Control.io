"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bell, ChevronDown, Database, Link2, Palette, Search, ShieldCheck, Tags, User, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/stat";
import { CategoriasTab } from "./CategoriasTab";
import { ProfileTab } from "./ProfileTab";
import type { SerializedCategory } from "@/lib/db/categories";

const SECTIONS = [
  { id: "cuenta", label: "Cuenta", description: "Perfil y sesión", icon: User, category: "Cuenta" },
  { id: "apariencia", label: "Apariencia", description: "Tema y visualización", icon: Palette, category: "Apariencia" },
  { id: "finanzas", label: "Finanzas", description: "Categorías de movimientos", icon: Tags, category: null },
  { id: "integraciones", label: "Integraciones", description: "WhatsApp y Google", icon: Link2, category: "Integraciones" },
  { id: "notificaciones", label: "Notificaciones", description: "Avisos, reportes y canales", icon: Bell, category: "Notificaciones" },
  { id: "seguridad", label: "Seguridad", description: "Acceso y dispositivos", icon: ShieldCheck, category: "Seguridad" },
  { id: "datos", label: "Datos y privacidad", description: "Control y eliminación", icon: Database, category: "Datos" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const legacyCategories = searchParams.get("tab") === "categorias";
  const requested = searchParams.get("section");
  const initialSection = SECTIONS.some((item) => item.id === requested)
    ? requested as SectionId
    : legacyCategories
      ? "finanzas"
      : "cuenta";
  const [section, setSection] = useState<SectionId>(initialSection);
  const [query, setQuery] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const active = SECTIONS.find((item) => item.id === section) ?? SECTIONS[0];
  const ActiveIcon = active.icon;

  useEffect(() => {
    if (SECTIONS.some((item) => item.id === requested)) {
      setSection(requested as SectionId);
    } else if (legacyCategories) {
      setSection("finanzas");
    }
  }, [legacyCategories, requested]);

  const selectSection = (id: SectionId) => {
    setSection(id);
    setQuery("");
    setMobileNavOpen(false);
    router.replace(`/configuracion?section=${id}`, { scroll: false });
  };

  const profileProps = {
    profileName,
    profileEmail,
    mfaEnabled,
    recoveryCodesRemaining,
    whatsappNumber,
  };

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 p-4 md:p-6">
      <PageHeader title="Configuración" subtitle="Administrá tu cuenta, preferencias, conexiones y privacidad." />

      <div className="relative max-w-md">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <Input
          type="search"
          inputMode="search"
          placeholder="Buscar una configuración..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="pl-9 pr-9"
          aria-label="Buscar configuración"
        />
        {query && (
          <button
            type="button"
            aria-label="Limpiar búsqueda"
            onClick={() => setQuery("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted hover:bg-surface-2 hover:text-foreground"
          >
            <X size={15} />
          </button>
        )}
      </div>

      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setMobileNavOpen((open) => !open)}
          className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface px-3.5 py-3 text-left"
        >
          <ActiveIcon size={18} className="text-primary" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-foreground">{active.label}</span>
            <span className="block text-xs text-muted">{active.description}</span>
          </span>
          <ChevronDown size={16} className={`text-muted transition-transform ${mobileNavOpen ? "rotate-180" : ""}`} />
        </button>
        {mobileNavOpen && (
          <div className="mt-2 space-y-1 rounded-xl border border-border bg-surface p-1.5">
            {SECTIONS.map((item) => (
              <SettingsNavItem key={item.id} item={item} active={item.id === section} onSelect={selectSection} />
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-8 md:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="hidden md:block">
          <nav className="sticky top-20 space-y-1" aria-label="Secciones de configuración">
            {SECTIONS.map((item) => (
              <SettingsNavItem key={item.id} item={item} active={item.id === section} onSelect={selectSection} />
            ))}
          </nav>
        </aside>

        <main className="min-w-0">
          {query ? (
            <>
              <SettingsSectionHeader title="Resultados" description={`Configuraciones relacionadas con “${query}”.`} />
              <ProfileTab {...profileProps} query={query} />
            </>
          ) : section === "finanzas" ? (
            <>
              <SettingsSectionHeader title="Finanzas" description="Organizá las categorías que usás para clasificar ingresos y gastos." />
              <CategoriasTab initialCategories={initialCategories} />
            </>
          ) : (
            <>
              <SettingsSectionHeader title={active.label} description={active.description} />
              <ProfileTab {...profileProps} category={active.category ?? undefined} />
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function SettingsSectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
      <p className="mt-0.5 text-sm text-muted">{description}</p>
    </div>
  );
}

function SettingsNavItem({
  item,
  active,
  onSelect,
}: {
  item: (typeof SECTIONS)[number];
  active: boolean;
  onSelect: (id: SectionId) => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
        active ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface-2 hover:text-foreground"
      }`}
    >
      <Icon size={17} className="shrink-0" />
      <span className="min-w-0">
        <span className={`block text-sm ${active ? "font-semibold" : "font-medium"}`}>{item.label}</span>
        <span className="block truncate text-[11px] opacity-75">{item.description}</span>
      </span>
    </button>
  );
}
