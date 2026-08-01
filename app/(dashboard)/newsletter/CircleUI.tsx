"use client";

import { UsersRound } from "lucide-react";

/** Encabezado de una sección interna de Mi Círculo. */
export function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
        {eyebrow}
      </p>
      <h2 className="mt-2 font-news text-3xl font-medium text-foreground sm:text-4xl">
        {title}
      </h2>
      <p className="mt-2 max-w-[65ch] text-sm leading-relaxed text-muted">
        {description}
      </p>
    </header>
  );
}

/** Estado vacío. En Mi Círculo "no hay nada" es una respuesta válida, no un error. */
export function QuietEmpty({ text }: { text: string }) {
  return (
    <div className="grid min-h-28 place-items-center px-4 py-6 text-center">
      <div>
        <UsersRound size={21} className="mx-auto text-muted-2" />
        <p className="mx-auto mt-2 max-w-[34ch] text-sm leading-relaxed text-muted">
          {text}
        </p>
      </div>
    </div>
  );
}
