/**
 * Sparkline — mini gráfico de línea sin ejes (SVG puro, sin librería).
 * Color por tendencia: verde si termina >= empieza, rojo si baja.
 */
export function Sparkline({
  data,
  width = 96,
  height = 28,
  className,
}: {
  data?: number[];
  width?: number;
  height?: number;
  className?: string;
}) {
  if (!data || data.length < 2) {
    return <div style={{ width, height }} className={className} />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const pad = 2;

  const y = (v: number) => height - pad - ((v - min) / range) * (height - pad * 2);
  const line = data.map((v, i) => `${(i * stepX).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `0,${height} ${line} ${width},${height}`;

  const up = data[data.length - 1] >= data[0];
  const color = up ? "var(--color-success)" : "var(--color-danger)";

  return (
    <svg width={width} height={height} className={className} aria-hidden="true">
      <polyline points={area} fill={color} fillOpacity={0.12} stroke="none" />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
