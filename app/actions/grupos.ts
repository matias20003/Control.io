"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getResend, FROM } from "@/lib/email/client";
import { invitacionGrupoHtml } from "@/lib/email/invitacion-grupo";

// ─── Recalcular divisiones iguales cuando cambia la cantidad de miembros ───
// Se llama cada vez que se agrega un miembro al grupo.
// Solo afecta gastos con tipo "igual" — los custom quedan intactos.

async function recalcularDivisionesIguales(grupoId: string) {
  const miembros = await prisma.miembroGrupo.findMany({ where: { grupoId } });
  const gastos = await prisma.gastoGrupo.findMany({
    where: { grupoId, tipo: "igual" },
  });

  for (const gasto of gastos) {
    const montoPorMiembro =
      Math.round((parseFloat(gasto.monto.toString()) / miembros.length) * 100) / 100;

    await prisma.divisionGasto.deleteMany({ where: { gastoId: gasto.id } });
    await prisma.divisionGasto.createMany({
      data: miembros.map((m) => ({
        gastoId: gasto.id,
        miembroId: m.id,
        monto: montoPorMiembro,
      })),
    });
  }
}

// ─── Crear grupo ───────────────────────────────────────────────────────────

const crearGrupoSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido").max(60),
  descripcion: z.string().max(200).optional(),
});

export async function crearGrupoAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  const raw = Object.fromEntries(formData);
  const result = crearGrupoSchema.safeParse(raw);
  if (!result.success) return { error: result.error.issues[0].message };

  const profile = await prisma.profile.findUnique({ where: { id: user.id } });
  if (!profile) return { error: "Perfil no encontrado" };

  const grupo = await prisma.grupoGasto.create({
    data: {
      nombre: result.data.nombre,
      descripcion: result.data.descripcion ?? null,
      userId: user.id,
      miembros: {
        create: {
          userId: user.id,
          nombre: profile.name ?? profile.email,
          email: profile.email,
          esCreador: true,
        },
      },
    },
  });

  revalidatePath("/grupos");
  redirect(`/grupos/${grupo.id}`);
}

// ─── Agregar miembro manualmente (sin invitar) ─────────────────────────────

const agregarMiembroSchema = z.object({
  grupoId: z.string().min(1),
  nombre: z.string().min(1, "El nombre es requerido").max(60),
});

export async function agregarMiembroAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  const raw = Object.fromEntries(formData);
  const result = agregarMiembroSchema.safeParse(raw);
  if (!result.success) return { error: result.error.issues[0].message };

  // Verificar que el usuario pertenece al grupo
  const grupo = await prisma.grupoGasto.findFirst({
    where: { id: result.data.grupoId, OR: [{ userId: user.id }, { miembros: { some: { userId: user.id } } }] },
  });
  if (!grupo) return { error: "Grupo no encontrado" };

  const miembro = await prisma.miembroGrupo.create({
    data: {
      grupoId: result.data.grupoId,
      nombre: result.data.nombre,
    },
  });

  // Recalcular todas las divisiones iguales con el nuevo miembro incluido
  await recalcularDivisionesIguales(result.data.grupoId);

  revalidatePath(`/grupos/${result.data.grupoId}`);
  return {
    success: true,
    miembro: {
      id: miembro.id,
      nombre: miembro.nombre,
      email: miembro.email,
      userId: miembro.userId,
      esCreador: miembro.esCreador,
      uniEn: miembro.uniEn.toISOString(),
    },
  };
}

// ─── Invitar miembro por email ─────────────────────────────────────────────

const invitarSchema = z.object({
  grupoId: z.string().min(1),
  email: z.string().email("Email inválido"),
  nombre: z.string().max(60).optional(),
});

export async function invitarMiembroAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  const raw = Object.fromEntries(formData);
  const result = invitarSchema.safeParse(raw);
  if (!result.success) return { error: result.error.issues[0].message };

  const { grupoId, email, nombre } = result.data;

  // Verificar que pertenece al grupo
  const grupo = await prisma.grupoGasto.findFirst({
    where: { id: grupoId, OR: [{ userId: user.id }, { miembros: { some: { userId: user.id } } }] },
    include: { miembros: true },
  });
  if (!grupo) return { error: "Grupo no encontrado" };

  // Verificar que no esté ya en el grupo
  const yaEsMiembro = grupo.miembros.some((m) => m.email === email);
  if (yaEsMiembro) return { error: "Esa persona ya está en el grupo" };

  // Verificar si ya tiene invitación pendiente
  const invExistente = await prisma.grupoInvitacion.findFirst({
    where: { grupoId, email, estado: "pendiente" },
  });
  if (invExistente) return { error: "Ya hay una invitación pendiente para ese email" };

  const expiraEn = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días

  const invitacion = await prisma.grupoInvitacion.create({
    data: { grupoId, email, nombre: nombre ?? null, expiraEn },
  });

  // Enviar email
  const invitadoPor = await prisma.profile.findUnique({ where: { id: user.id } });
  const invitadoPorNombre = invitadoPor?.name ?? invitadoPor?.email ?? "Alguien";
  const link = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://control-io.vercel.app"}/grupos/unirse/${invitacion.token}`;

  try {
    const resend = getResend();
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: `${invitadoPorNombre} te invitó al grupo "${grupo.nombre}" en control.io`,
      html: invitacionGrupoHtml({
        grupoNombre: grupo.nombre,
        invitadoPorNombre,
        nombreInvitado: nombre,
        link,
      }),
    });
  } catch {
    // Si el email falla, igual guardamos la invitación (pueden reenviar)
    return { success: true, warning: "Invitación creada pero el email no pudo enviarse" };
  }

  revalidatePath(`/grupos/${grupoId}`);
  return { success: true };
}

// ─── Agregar gasto ─────────────────────────────────────────────────────────

const agregarGastoSchema = z.object({
  grupoId: z.string().min(1),
  descripcion: z.string().min(1, "La descripción es requerida").max(120),
  monto: z.coerce.number().positive("El monto debe ser mayor a 0"),
  pagadoPorId: z.string().min(1, "Seleccioná quién pagó"),
  tipo: z.enum(["igual", "custom"]).default("igual"),
});

export async function agregarGastoAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  const raw = Object.fromEntries(formData);
  const result = agregarGastoSchema.safeParse(raw);
  if (!result.success) return { error: result.error.issues[0].message };

  const { grupoId, descripcion, monto, pagadoPorId, tipo } = result.data;

  // Verificar acceso al grupo
  const grupo = await prisma.grupoGasto.findFirst({
    where: { id: grupoId, OR: [{ userId: user.id }, { miembros: { some: { userId: user.id } } }] },
    include: { miembros: true },
  });
  if (!grupo) return { error: "Grupo no encontrado" };

  // Verificar que pagadoPorId es miembro del grupo
  const pagador = grupo.miembros.find((m) => m.id === pagadoPorId);
  if (!pagador) return { error: "El pagador no es miembro del grupo" };

  // Construir divisiones
  let divisiones: { miembroId: string; monto: number }[] = [];

  if (tipo === "igual") {
    const montoPorMiembro = monto / grupo.miembros.length;
    divisiones = grupo.miembros.map((m) => ({
      miembroId: m.id,
      monto: Math.round(montoPorMiembro * 100) / 100,
    }));
  } else {
    // custom: viene como montos_<miembroId> en formData
    for (const m of grupo.miembros) {
      const val = parseFloat(formData.get(`montos_${m.id}`) as string ?? "0");
      if (val > 0) divisiones.push({ miembroId: m.id, monto: val });
    }
    const totalDiv = divisiones.reduce((s, d) => s + d.monto, 0);
    if (Math.abs(totalDiv - monto) > 0.1) {
      return { error: "La suma de las divisiones no coincide con el monto total" };
    }
  }

  const gasto = await prisma.gastoGrupo.create({
    data: {
      grupoId,
      descripcion,
      monto,
      pagadoPorId,
      tipo,
      divisiones: { create: divisiones },
    },
    include: { divisiones: true, pagadoPor: true },
  });

  revalidatePath(`/grupos/${grupoId}`);
  return {
    success: true,
    gasto: {
      id: gasto.id,
      descripcion: gasto.descripcion,
      monto: parseFloat(gasto.monto.toString()),
      pagadoPorId: gasto.pagadoPorId,
      pagadoPorNombre: gasto.pagadoPor.nombre,
      fecha: gasto.fecha.toISOString(),
      divisiones: gasto.divisiones.map((d) => ({
        id: d.id,
        miembroId: d.miembroId,
        monto: parseFloat(d.monto.toString()),
      })),
    },
  };
}

// ─── Eliminar gasto ────────────────────────────────────────────────────────

export async function eliminarGastoAction(gastoId: string, grupoId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  // Verificar acceso
  const gasto = await prisma.gastoGrupo.findFirst({
    where: { id: gastoId, grupo: { OR: [{ userId: user.id }, { miembros: { some: { userId: user.id } } }] } },
  });
  if (!gasto) return { error: "Gasto no encontrado" };

  await prisma.gastoGrupo.delete({ where: { id: gastoId } });
  revalidatePath(`/grupos/${grupoId}`);
  return { success: true };
}

// ─── Eliminar grupo ────────────────────────────────────────────────────────

export async function eliminarGrupoAction(grupoId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  // Solo el creador puede eliminar
  const grupo = await prisma.grupoGasto.findFirst({
    where: { id: grupoId, userId: user.id },
  });
  if (!grupo) return { error: "Solo el creador puede eliminar el grupo" };

  await prisma.grupoGasto.delete({ where: { id: grupoId } });
  revalidatePath("/grupos");
  redirect("/grupos");
}

// ─── Aceptar invitación ────────────────────────────────────────────────────

export async function aceptarInvitacionAction(token: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    // Guardar token en cookie y redirigir a login
    redirect(`/login?redirect=/grupos/unirse/${token}`);
  }

  const invitacion = await prisma.grupoInvitacion.findUnique({
    where: { token },
    include: { grupo: { include: { miembros: true } } },
  });

  if (!invitacion) return { error: "Invitación no encontrada" };
  if (invitacion.estado !== "pendiente") return { error: "Esta invitación ya fue usada o expiró" };
  if (invitacion.expiraEn < new Date()) {
    await prisma.grupoInvitacion.update({ where: { token }, data: { estado: "expirada" } });
    return { error: "Esta invitación expiró" };
  }

  // Verificar que no es ya miembro
  const yaEsMiembro = invitacion.grupo.miembros.some((m) => m.userId === user.id);
  if (yaEsMiembro) {
    redirect(`/grupos/${invitacion.grupoId}`);
  }

  const profile = await prisma.profile.findUnique({ where: { id: user.id } });

  await prisma.$transaction([
    prisma.miembroGrupo.create({
      data: {
        grupoId: invitacion.grupoId,
        userId: user.id,
        nombre: invitacion.nombre ?? profile?.name ?? profile?.email ?? "Miembro",
        email: profile?.email ?? invitacion.email,
      },
    }),
    prisma.grupoInvitacion.update({
      where: { token },
      data: { estado: "aceptada" },
    }),
  ]);

  // Recalcular divisiones iguales con el nuevo miembro incluido
  await recalcularDivisionesIguales(invitacion.grupoId);

  revalidatePath(`/grupos/${invitacion.grupoId}`);
  revalidatePath("/grupos");
  redirect(`/grupos/${invitacion.grupoId}`);
}
