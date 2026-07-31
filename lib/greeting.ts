/**
 * Franja horaria del saludo del dashboard. Madrugada cuenta como noche.
 *
 * Vive en un módulo neutral (sin "use client") porque la usan los dos lados:
 * el server la llama para el primer render y el componente cliente la vuelve a
 * evaluar con la hora del dispositivo. Exportada desde un módulo de cliente,
 * llamarla en el servidor rompe: Next la convierte en una referencia.
 */
export function greetingFor(hour: number): string {
  if (hour >= 6 && hour < 12) return "Buenos días";
  if (hour >= 12 && hour < 20) return "Buenas tardes";
  return "Buenas noches";
}
