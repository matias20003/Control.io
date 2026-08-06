import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PlanEstudioClient } from "@/components/study/PlanEstudioClient";
import { getStudyPlans } from "@/lib/db/study-career";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Plan de estudio" };

export default async function PlanEstudioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) redirect("/dashboard");

  const [plans, examRows] = await Promise.all([
    getStudyPlans(user.id),
    // Sólo exámenes que todavía no pasaron: repartir material para algo que ya
    // rendiste no le sirve a nadie.
    prisma.studyExam.findMany({
      where: { userId: user.id, done: false, examDate: { gte: new Date() } },
      orderBy: { examDate: "asc" },
      take: 30,
    }),
  ]);

  const subjects = await prisma.studySubject.findMany({
    where: { userId: user.id, id: { in: [...new Set(examRows.map((exam) => exam.subjectId))] } },
    select: { id: true, name: true },
  });
  const subjectName = new Map(subjects.map((subject) => [subject.id, subject.name]));

  return (
    <PlanEstudioClient
      plans={plans}
      exams={examRows.map((exam) => ({
        id: exam.id,
        title: exam.title,
        examDate: exam.examDate.toISOString(),
        subjectName: subjectName.get(exam.subjectId) ?? "Materia",
      }))}
    />
  );
}
