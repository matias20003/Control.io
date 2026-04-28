"use client";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export function ErrorPage({ error, reset }: Props) {
  return (
    <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
      <p className="text-4xl mb-3">😵</p>
      <h2 className="text-lg font-bold text-foreground mb-1">Algo salió mal</h2>
      <p className="text-sm text-muted mb-6 max-w-xs">
        {error.message || "Ocurrió un error inesperado. Intentá de nuevo."}
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 text-sm font-medium bg-primary text-background rounded-xl hover:opacity-90 transition-opacity"
      >
        Intentar de nuevo
      </button>
    </div>
  );
}
