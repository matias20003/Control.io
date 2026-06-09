import { LogoFull, LogoIcon } from "@/components/layout/Logo";

export default function LogoPreview() {
  return (
    <div className="min-h-dvh bg-background p-12 flex flex-col gap-10">
      <div className="flex flex-col gap-6">
        <LogoFull size="xs" />
        <LogoFull size="sm" />
        <LogoFull size="md" />
        <LogoFull size="lg" />
      </div>
      <div className="flex items-center gap-6">
        <LogoIcon size={32} />
        <LogoIcon size={48} />
        <LogoIcon size={64} />
      </div>
    </div>
  );
}
