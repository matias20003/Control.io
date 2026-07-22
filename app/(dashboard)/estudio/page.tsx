import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStudyNotes, getUpcomingReviews } from "@/lib/db/study";
import { listSubjects, listBlocks, getTodayPlan, studyStats } from "@/lib/db/study-system";
import { StudySystemClient } from "./StudySystemClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Estudio" };

export default async function EstudioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) redirect("/dashboard");

  const [notes, reviews, subjects, blocks, plan, stats] = await Promise.all([
    getStudyNotes(user.id).catch(() => []),
    getUpcomingReviews(user.id).catch(() => []),
    listSubjects(user.id).catch(() => []),
    listBlocks(user.id).catch(() => []),
    getTodayPlan(user.id).catch(() => ({ items: [], totalMin: 0, budgetMin: 240, overflow: [] })),
    studyStats(user.id).catch(() => ({ total: 0, byLevel: {}, dueToday: 0, overdue: 0 })),
  ]);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <StudySystemClient
        initialSubjects={subjects}
        initialBlocks={blocks}
        initialPlan={plan}
        stats={stats}
        notes={notes}
        reviews={reviews}
      />
    </div>
  );
}
