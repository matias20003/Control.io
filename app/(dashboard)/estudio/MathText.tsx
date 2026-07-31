"use client";

import { Fragment, useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

function renderMath(latex: string, display: boolean): string {
  try {
    return katex.renderToString(latex, { throwOnError: false, displayMode: display, output: "html" });
  } catch {
    return latex;
  }
}

export function MathText({ text, className }: { text: string; className?: string }) {
  const lines = useMemo(() => text.split(/\r?\n/), [text]);

  const renderInline = (value: string, lineIndex: number) => {
    const parts = value.split(/(\$\$[^$]+\$\$|\$[^$\n]+\$|\*\*[^*]+\*\*)/g).filter(Boolean);

    return parts.map((part, partIndex) => {
      const key = `${lineIndex}-${partIndex}`;

      if (part.startsWith("$$") && part.endsWith("$$")) {
        return (
          <span
            key={key}
            className="study-math-display block max-w-full overflow-x-auto py-2"
            dangerouslySetInnerHTML={{ __html: renderMath(part.slice(2, -2), true) }}
          />
        );
      }
      if (part.startsWith("$") && part.endsWith("$") && part.length > 2) {
        return <span key={key} dangerouslySetInnerHTML={{ __html: renderMath(part.slice(1, -1), false) }} />;
      }
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={key} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
      }
      return <Fragment key={key}>{part}</Fragment>;
    });
  };

  return (
    <div className={className}>
      {lines.map((line, lineIndex) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={lineIndex} className="h-3" aria-hidden="true" />;
        if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
          return <hr key={lineIndex} className="my-5 border-border/70" />;
        }

        const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
        if (heading) {
          const level = heading[1].length;
          return (
            <div
              key={lineIndex}
              role="heading"
              aria-level={Math.min(level, 6)}
              className={level <= 2 ? "mb-2 mt-6 text-lg font-bold text-foreground" : "mb-2 mt-5 text-base font-bold text-foreground"}
            >
              {renderInline(heading[2], lineIndex)}
            </div>
          );
        }

        const bullet = trimmed.match(/^[-*]\s+(.+)$/);
        if (bullet) {
          return (
            <div key={lineIndex} className="grid grid-cols-[0.45rem_1fr] gap-2.5 py-0.5">
              <span className="mt-[0.65em] h-1.5 w-1.5 rounded-full bg-primary/70" aria-hidden="true" />
              <div>{renderInline(bullet[1], lineIndex)}</div>
            </div>
          );
        }

        return <div key={lineIndex} className="min-w-0 py-0.5">{renderInline(line, lineIndex)}</div>;
      })}
    </div>
  );
}
