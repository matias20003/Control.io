// Agente conversacional del sistema de estudio. Corre un loop de tool-calling
// (OpenAI-compatible, vía OpenRouter con gemini-2.5-flash) para que el usuario
// controle el sistema hablando: crear materias, bloques, exámenes, ejercicios,
// consultar el plan de hoy. Reusa las funciones de lib/db/study-system.

import {
  listSubjects, createSubject, createBlock, createExam, createExercise,
  getTodayPlan, type SubjectDTO,
} from "@/lib/db/study-system";
import { todayStringArg } from "@/lib/timezone";

// Proveedor de IA: preferimos la Gemini API de Google (gratis, endpoint
// compatible con OpenAI). Si no hay GEMINI_API_KEY, caemos a OpenRouter.
function aiProvider(): { url: string; key: string; model: string; extraHeaders: Record<string, string> } | null {
  const gem = process.env.GEMINI_API_KEY;
  if (gem) {
    return {
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      key: gem,
      model: process.env.STUDY_AGENT_MODEL ?? "gemini-flash-latest",
      extraHeaders: {},
    };
  }
  const or = process.env.OPENROUTER_API_KEY;
  if (or) {
    return {
      url: "https://openrouter.ai/api/v1/chat/completions",
      key: or,
      model: process.env.STUDY_AGENT_MODEL ?? "google/gemini-2.5-flash",
      extraHeaders: {
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "https://controlio.site",
        "X-Title": "control.io estudio",
      },
    };
  }
  return null;
}

export type ChatMsg = { role: "user" | "assistant"; content: string };
export type AgentResult = { reply: string; actions: string[]; error?: string };

type Tool = { type: "function"; function: { name: string; description: string; parameters: object } };

const TOOLS: Tool[] = [
  { type: "function", function: { name: "list_subjects", description: "Lista las materias del usuario (nombre y código).", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "get_today_plan", description: "Devuelve los bloques a estudiar hoy (tema y minutos).", parameters: { type: "object", properties: {} } } },
  {
    type: "function", function: {
      name: "create_subject", description: "Crea una materia nueva.",
      parameters: { type: "object", properties: {
        name: { type: "string", description: "Nombre completo, ej: Análisis Matemático II" },
        code: { type: "string", description: "Código corto, ej: AM2" },
        type: { type: "string", enum: ["anual", "cuatrimestral"] },
      }, required: ["name", "code"] },
    },
  },
  {
    type: "function", function: {
      name: "create_block", description: "Crea un bloque/tema de estudio en una materia. Entra al plan de hoy.",
      parameters: { type: "object", properties: {
        subjectCode: { type: "string", description: "Código de la materia (debe existir; si no, creala antes)" },
        topic: { type: "string", description: "Tema del bloque" },
        parcial: { type: "number", description: "Número de parcial (1,2,3). Default 1" },
        importance: { type: "number", description: "1 baja … 4 muy alta. Default 2" },
        difficulty: { type: "number", description: "1 … 4. Default 2" },
      }, required: ["subjectCode", "topic"] },
    },
  },
  {
    type: "function", function: {
      name: "create_exam", description: "Agenda un examen/parcial de una materia.",
      parameters: { type: "object", properties: {
        subjectCode: { type: "string" },
        title: { type: "string", description: "Ej: Segundo parcial" },
        examDate: { type: "string", description: "Fecha ISO YYYY-MM-DD" },
        importance: { type: "number" },
      }, required: ["subjectCode", "title", "examDate"] },
    },
  },
  {
    type: "function", function: {
      name: "create_exercise", description: "Agrega un ejercicio/tarea de práctica a hacer.",
      parameters: { type: "object", properties: {
        description: { type: "string" },
        subjectCode: { type: "string", description: "opcional" },
      }, required: ["description"] },
    },
  },
];

function findSubject(subjects: SubjectDTO[], code: string): SubjectDTO | undefined {
  const c = code.trim().toLowerCase();
  return subjects.find((s) => s.code.toLowerCase() === c) ?? subjects.find((s) => s.name.toLowerCase().includes(c));
}

async function execTool(userId: string, name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "list_subjects": {
      const subs = await listSubjects(userId);
      return subs.map((s) => ({ name: s.name, code: s.code, type: s.type }));
    }
    case "get_today_plan": {
      const plan = await getTodayPlan(userId);
      return {
        total: plan.items.length,
        totalMin: plan.totalMin,
        items: plan.items.map((i) => ({ code: i.code, topic: i.topic, min: i.reviewDuration, nivel: i.masteryLevel })),
      };
    }
    case "create_subject": {
      const s = await createSubject(userId, { name: String(args.name), code: String(args.code), type: args.type ? String(args.type) : undefined });
      return { ok: true, subject: { name: s.name, code: s.code } };
    }
    case "create_block": {
      const subs = await listSubjects(userId);
      const subject = findSubject(subs, String(args.subjectCode));
      if (!subject) return { ok: false, error: `No existe la materia "${args.subjectCode}". Creala primero con create_subject.` };
      const b = await createBlock(userId, {
        subjectId: subject.id,
        parcial: Number(args.parcial) || 1,
        topic: String(args.topic),
        importance: args.importance != null ? Number(args.importance) : undefined,
        difficulty: args.difficulty != null ? Number(args.difficulty) : undefined,
      });
      return { ok: true, block: { code: b.code, topic: b.topic } };
    }
    case "create_exam": {
      const subs = await listSubjects(userId);
      const subject = findSubject(subs, String(args.subjectCode));
      if (!subject) return { ok: false, error: `No existe la materia "${args.subjectCode}".` };
      const date = new Date(String(args.examDate));
      if (isNaN(date.getTime())) return { ok: false, error: "Fecha inválida (usá YYYY-MM-DD)." };
      const e = await createExam(userId, { subjectId: subject.id, title: String(args.title), examDate: date, importance: args.importance != null ? Number(args.importance) : undefined });
      return { ok: true, exam: { title: e.title } };
    }
    case "create_exercise": {
      let subjectId: string | null = null;
      if (args.subjectCode) {
        const subs = await listSubjects(userId);
        subjectId = findSubject(subs, String(args.subjectCode))?.id ?? null;
      }
      await createExercise(userId, { description: String(args.description), subjectId });
      return { ok: true };
    }
    default:
      return { ok: false, error: "herramienta desconocida" };
  }
}

const ACTION_LABELS: Record<string, (a: Record<string, unknown>) => string> = {
  create_subject: (a) => `Materia creada: ${a.name} (${a.code})`,
  create_block: (a) => `Bloque creado: ${a.topic}`,
  create_exam: (a) => `Examen agendado: ${a.title}`,
  create_exercise: (a) => `Ejercicio agregado`,
};

export async function runStudyAgent(userId: string, history: ChatMsg[]): Promise<AgentResult> {
  const provider = aiProvider();
  if (!provider) return { reply: "", actions: [], error: "falta configurar la key de IA (GEMINI_API_KEY)" };

  // Contexto actual para el system prompt.
  const [subjects, plan] = await Promise.all([
    listSubjects(userId).catch(() => []),
    getTodayPlan(userId).catch(() => ({ items: [], totalMin: 0 } as { items: unknown[]; totalMin: number })),
  ]);
  const subjList = subjects.length ? subjects.map((s) => `${s.name} (${s.code})`).join(", ") : "ninguna todavía";

  const system = `Sos el asistente del sistema de estudio de un estudiante (repetición espaciada: materias → bloques/temas → sesiones). Hablás en español rioplatense, claro y directo. Hoy es ${todayStringArg()}.
Materias actuales: ${subjList}.
Bloques en el plan de hoy: ${plan.items.length}.

Podés EJECUTAR acciones con las herramientas (crear materias, bloques, exámenes, ejercicios) y CONSULTAR (list_subjects, get_today_plan). Reglas:
- Para crear un bloque necesitás una materia existente (código). Si el usuario nombra una materia que no existe, creala primero con create_subject y después el bloque.
- Confirmá lo que hiciste en lenguaje natural y breve. No inventes datos: si falta algo (código de materia, fecha), preguntá.
- Si el pedido es solo una consulta o charla, respondé sin llamar herramientas.`;

  const messages: Record<string, unknown>[] = [
    { role: "system", content: system },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];
  const actions: string[] = [];

  for (let step = 0; step < 6; step++) {
    let res: Response;
    try {
      res = await fetch(provider.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${provider.key}`,
          "Content-Type": "application/json",
          ...provider.extraHeaders,
        },
        body: JSON.stringify({ model: provider.model, temperature: 0.3, messages, tools: TOOLS, tool_choice: "auto" }),
      });
    } catch {
      return { reply: "", actions, error: "No pude conectar con la IA. Probá de nuevo." };
    }
    if (!res.ok) return { reply: "", actions, error: "La IA no respondió bien. Probá de nuevo." };

    const data = await res.json();
    const msg = data?.choices?.[0]?.message;
    if (!msg) return { reply: "", actions, error: "Respuesta vacía de la IA." };

    const toolCalls = msg.tool_calls as { id: string; function: { name: string; arguments: string } }[] | undefined;
    if (!toolCalls || toolCalls.length === 0) {
      return { reply: (msg.content ?? "").trim() || "Listo.", actions };
    }

    // Ejecutar las herramientas pedidas y devolver los resultados al modelo.
    messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: toolCalls });
    for (const tc of toolCalls) {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* args inválidos */ }
      let result: unknown;
      try { result = await execTool(userId, tc.function.name, args); }
      catch (e) { result = { ok: false, error: e instanceof Error ? e.message : "error ejecutando" }; }
      if ((result as { ok?: boolean })?.ok && ACTION_LABELS[tc.function.name]) {
        actions.push(ACTION_LABELS[tc.function.name](args));
      }
      messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
    }
  }

  return { reply: "Hice varios pasos pero me pasé de vueltas. Fijate el resultado y decime si falta algo.", actions };
}
