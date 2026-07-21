import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStudyNotes, getUpcomingReviews } from "@/lib/db/study";
import { EstudioClient } from "./EstudioClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Estudio" };

export default async function EstudioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) redirect("/dashboard");

  const [notes, reviews] = await Promise.all([
    getStudyNotes(user.id).catch(() => []),
    getUpcomingReviews(user.id).catch(() => []),
  ]);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <EstudioClient notes={notes} reviews={reviews} />
    </div>
  );
}
