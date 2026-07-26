"use client";

import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

// Renderiza texto con matemática en LaTeX. La IA envuelve la matemática en
// $…$ (inline) o $$…$$ (bloque); acá la convertimos a fórmulas reales con KaTeX.
// El resto del texto respeta **negritas** y saltos de línea.

function renderMath(latex: string, display: boolean): string {
  try {
    return katex.renderToString(latex, { throwOnError: false, displayMode: display, output: "html" });
  } catch {
    return latex;
  }
}

export function MathText({ text, className }: { text: string; className?: string }) {
  const parts = useMemo(() => {
    // Divide por $$…$$ (bloque) y $…$ (inline), conservando los delimitadores.
    return text.split(/(\$\$[^$]+\$\$|\$[^$\n]+\$)/g).filter((p) => p !== "");
  }, [text]);

  return (
    <span className={className}>
      {parts.map((p, i) => {
        if (p.startsWith("$$") && p.endsWith("$$")) {
          return <span key={i} className="block my-1 overflow-x-auto" dangerouslySetInnerHTML={{ __html: renderMath(p.slice(2, -2), true) }} />;
        }
        if (p.startsWith("$") && p.endsWith("$") && p.length > 2) {
          return <span key={i} dangerouslySetInnerHTML={{ __html: renderMath(p.slice(1, -1), false) }} />;
        }
        // Texto normal: **negrita** + saltos de línea.
        return (
          <span key={i}>
            {p.split(/(\*\*[^*]+\*\*)/g).map((seg, j) =>
              seg.startsWith("**") && seg.endsWith("**")
                ? <strong key={j} className="text-foreground">{seg.slice(2, -2)}</strong>
                : <span key={j} className="whitespace-pre-wrap">{seg}</span>
            )}
          </span>
        );
      })}
    </span>
  );
}
