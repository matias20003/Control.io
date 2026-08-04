import { redirect } from "next/navigation";

/**
 * Mi Círculo ya tiene su propia portada dentro de /newsletter (la ración del
 * día, los vínculos que tocan y las herramientas). Hasta darle ruta propia a
 * cada sección, el pilar entra por ahí.
 */
export default function CirculoPage() {
  redirect("/newsletter");
}
