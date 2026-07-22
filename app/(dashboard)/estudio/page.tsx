import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStudyNotes, getUpcomingReviews } from "@/lib/db/study";
import {
  listSubjects, listBlocks, getTodayPlan, studyStats,
  listExams, listExercises, listRecentErrors, listAvailability,
} from "@/lib/db/study-system";
import { getStudySettings } from "@/lib/study/notify";
import { StudySystemClient } from "./StudySystemClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Estudio" };

export default async function EstudioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) redirect("/dashboard");

  const [notes, reviews, subjects, blocks, plan, stats, exams, exercises, errors, availability, settings] = await Promise.all([
    getStudyNotes(user.id).catch(() => []),
    getUpcomingReviews(user.id).catch(() => []),
    listSubjects(user.id).catch(() => []),
    listBlocks(user.id).catch(() => []),
    getTodayPlan(user.id).catch(() => ({ items: [], totalMin: 0, budgetMin: 240, overflow: [], isRestDay: false })),
    studyStats(user.id).catch(() => ({ total: 0, byLevel: {}, dueToday: 0, overdue: 0 })),
    listExams(user.id).catch(() => []),
    listExercises(user.id).catch(() => []),
    listRecentErrors(user.id).catch(() => []),
    listAvailability(user.id).catch(() => []),
    getStudySettings(user.id).catch(() => ({ planHour: 8, planMinute: 0, notifyEnabled: true, lastPlanSent: null })),
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
        initialExams={exams}
        initialExercises={exercises}
        initialErrors={errors}
        availability={availability}
        settings={settings}
      />
    </div>
  );
}
