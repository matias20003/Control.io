import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { parseDevice } from "@/lib/device-session";

const COOKIE_NAME = "controlio_device";
const DEVICE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const cookieStore = await cookies();
  const headerStore = await headers();
  const storedId = cookieStore.get(COOKIE_NAME)?.value;
  const currentId = storedId && DEVICE_ID_PATTERN.test(storedId) ? storedId : crypto.randomUUID();
  const details = parseDevice(headerStore.get("user-agent") ?? "");

  await prisma.deviceSession.upsert({
    where: { userId_deviceId: { userId: user.id, deviceId: currentId } },
    create: { userId: user.id, deviceId: currentId, ...details },
    update: { ...details, lastSeenAt: new Date() },
  });

  const sessions = await prisma.deviceSession.findMany({
    where: { userId: user.id },
    orderBy: { lastSeenAt: "desc" },
    take: 20,
  });

  const response = NextResponse.json({
    sessions: sessions.map((session) => ({
      id: session.id,
      deviceType: session.deviceType,
      browser: session.browser,
      os: session.os,
      lastSeenAt: session.lastSeenAt.toISOString(),
      createdAt: session.createdAt.toISOString(),
      current: session.deviceId === currentId,
    })),
  });
  if (storedId !== currentId) {
    response.cookies.set(COOKIE_NAME, currentId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return response;
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const cookieStore = await cookies();
  const currentId = cookieStore.get(COOKIE_NAME)?.value;
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) return NextResponse.json({ error: "No se pudieron cerrar las sesiones" }, { status: 400 });

  await prisma.deviceSession.deleteMany({
    where: {
      userId: user.id,
      ...(currentId ? { deviceId: { not: currentId } } : {}),
    },
  });
  return NextResponse.json({ success: true });
}
