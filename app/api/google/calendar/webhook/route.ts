import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncGoogleOrganization } from "@/lib/google-organization";

export async function POST(request: NextRequest) {
  const channelId = request.headers.get("x-goog-channel-id");
  const channelToken = request.headers.get("x-goog-channel-token");
  if (!channelId || !channelToken) return NextResponse.json({ ok: false }, { status: 400 });
  const sync = await prisma.googleCalendarSync.findFirst({
    where: { channelId, channelToken },
    select: { userId: true },
  });
  if (!sync) return NextResponse.json({ ok: false }, { status: 404 });
  await syncGoogleOrganization(sync.userId).catch(async (error) => {
    await prisma.googleCalendarSync.update({
      where: { userId: sync.userId },
      data: { lastError: error instanceof Error ? error.message : "Webhook sync error" },
    }).catch(() => null);
  });
  return NextResponse.json({ ok: true });
}
