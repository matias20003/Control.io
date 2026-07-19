import { prisma } from "@/lib/prisma";

export type FollowupUser = {
  name: string | null;
  email: string;
  emailedAt: string; // ISO
  returned: boolean;
};

export type ReactivationFollowup = {
  emailed: number;
  returned: number;
  waiting: number;
  conversion: number; // 0-100
  users: FollowupUser[];
};

/**
 * Seguimiento de la campaña de reactivación: de los usuarios a los que se les
 * mandó el correo (reactivationNudgeAt), cuántos VOLVIERON después.
 * "Volvió" = registró un movimiento después del mail, o tuvo un día activo
 * desde la fecha del mail (los candidatos venían dormidos 14+ días, así que
 * cualquier actividad post-mail cuenta como reactivación real).
 */
export async function getReactivationFollowup(): Promise<ReactivationFollowup> {
  const rows = await prisma.$queryRaw<
    { name: string | null; email: string; emailed: Date; returned: boolean }[]
  >`
    SELECT p.name, p.email, p."reactivationNudgeAt" AS emailed,
      (
        EXISTS (SELECT 1 FROM transactions t
          WHERE t."userId" = p.id AND t."createdAt" > p."reactivationNudgeAt")
        OR EXISTS (SELECT 1 FROM user_active_days d
          WHERE d.user_id = p.id AND d.day >= (p."reactivationNudgeAt")::date)
      ) AS returned
    FROM profiles p
    WHERE p."reactivationNudgeAt" IS NOT NULL
    ORDER BY (
      EXISTS (SELECT 1 FROM transactions t
        WHERE t."userId" = p.id AND t."createdAt" > p."reactivationNudgeAt")
      OR EXISTS (SELECT 1 FROM user_active_days d
        WHERE d.user_id = p.id AND d.day >= (p."reactivationNudgeAt")::date)
    ) DESC, p."reactivationNudgeAt" DESC
    LIMIT 100`;

  const emailed = rows.length;
  const returned = rows.filter((r) => r.returned).length;
  return {
    emailed,
    returned,
    waiting: emailed - returned,
    conversion: emailed ? Math.round((returned / emailed) * 100) : 0,
    users: rows.map((r) => ({
      name: r.name,
      email: r.email,
      emailedAt: r.emailed.toISOString(),
      returned: r.returned,
    })),
  };
}
