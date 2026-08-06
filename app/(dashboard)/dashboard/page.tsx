import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMonthSummary } from "@/lib/db/transactions";
import { getNetWorth } from "@/lib/db/insights";
import { getTrends } from "@/lib/db/trends";
import { getAgenda } from "@/lib/db/agenda";
import { getOrganization } from "@/lib/db/organization";
import { getCircleContacts } from "@/lib/db/circle";
import { getIsTester } from "@/lib/db/profile";
import { hasFeature } from "@/lib/feature-flags";
import { FinanceDashboard } from "./FinanceDashboard";
import { HomeSummary } from "./HomeSummary";

export const metadata: Metadata = { title: "Inicio" };

/**
 * Inicio.
 *
 * Para el dueño es el resumen de los tres pilares — la plata, el tiempo y los
 * vínculos, un bloque cada uno. Para el resto sigue siendo el tablero de
 * finanzas de siempre, que es lo que esta pantalla venía siendo: sus doce
 * bloques son todos de plata, así que "Inicio" y "Finanzas" eran la misma cosa
 * sin que nadie lo dijera.
 */
export default async function InicioPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const isOwner = !!process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL;
  if (!isOwner) return <FinanceDashboard searchParams={searchParams} />;

  const isTester = await getIsTester(user.id).catch(() => false);
  const showCircle = hasFeature("circuloCercanos", { isTester });

  // Cada consulta cae sola si falla: un resumen es lo último que debería
  // romperse entero porque una de sus tres partes tuvo un mal día.
  const [month, netWorth, agenda, organization, contacts, trends] = await Promise.all([
    getMonthSummary(user.id),
    getNetWorth(user.id).catch(() => null),
    getAgenda(user.id, 30).catch(() => []),
    getOrganization(user.id).catch(() => ({ tasks: [], lists: [], habits: [] })),
    showCircle ? getCircleContacts(user.id).catch(() => []) : Promise.resolve([]),
    getTrends(user.id, 6).catch(() => null),
  ]);

  const series = trends?.months ?? [];
  // Las tres categorías más pesadas del mes: más que eso deja de leerse de un
  // vistazo, que es lo único que esta pantalla tiene que lograr.
  const topCategories = [...month.byCategory]
    .sort((a, b) => b.total - a.total)
    .slice(0, 3)
    .map((category) => ({ name: category.name, total: category.total, color: category.color }));

  return (
    <main className="mx-auto w-full max-w-[1500px] space-y-5 pb-24">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Inicio</h1>
        <p className="mt-1 text-sm text-muted">Tu plata, tu tiempo y tu gente, en una sola mirada.</p>
      </header>
      <HomeSummary
        month={month}
        positions={netWorth?.byCurrency ?? []}
        agenda={agenda}
        tasks={organization.tasks}
        habits={organization.habits}
        contacts={contacts}
        showCircle={showCircle}
        trend={series.map((entry) => ({ label: entry.label, income: entry.income, expense: entry.expense }))}
        balanceSeries={series.map((entry) => ({ label: entry.label, balance: entry.balance }))}
        topCategories={topCategories}
      />
    </main>
  );
}
