// Pipeline autônomo: a IA COMPLETA uma tarefa imitando o estilo do usuário
// (mesma lógica do chat.completeTask) e ENVIA o resultado por e-mail. Usado
// pela sincronização automática do Toddle quando a automação está ligada.
// Sem interação: roda no cron, no estilo do próprio usuário.

import * as db from "./db";
import { invokeLLM } from "./_core/llm";
import { sendCompletedTaskEmail } from "./email";

type TaskRow = {
  id: number;
  title: string;
  subject?: string | null;
  type?: string | null;
  description?: string | null;
  notes?: string | null;
  completedContent?: string | null;
};

// Gera o texto da tarefa "como se fosse o usuário", usando prefs + memórias
// como amostras de estilo. Retorna "" se o LLM não produzir nada.
export async function generateCompletion(userId: number, task: TaskRow): Promise<string> {
  const prefs = await db.getUserPreferences(userId);
  const memories = await db.getUserMemoriesByUserId(userId);

  let systemPrompt =
    `Você é o próprio usuário completando uma tarefa escolar. Escreva na primeira pessoa e imite ` +
    `fielmente o estilo, tom e vocabulário do usuário conforme as memórias.\n` +
    `Nunca mencione que é IA, nunca fale da tarefa em terceira pessoa. Produza só o texto final, ` +
    `como se fosse o usuário. Responda em Português (BR).`;

  if (prefs?.aiStyle) systemPrompt += `\n\nEstilo preferido: ${prefs.aiStyle}`;

  if (memories && memories.length > 0) {
    systemPrompt += `\n\nAmostras do estilo de escrita do usuário (imite a forma de escrever):\n`;
    for (const memory of memories.slice(0, 5)) {
      systemPrompt += `\n--- ${memory.title}${memory.category ? ` (${memory.category})` : ""} ---\n${String(memory.content).substring(0, 800)}\n`;
    }
  } else {
    systemPrompt +=
      `\n\nSem memórias do estilo do usuário: escreva em tom natural de estudante brasileiro, ` +
      `direto e claro, frases de tamanho médio, sem gírias exageradas nem termos rebuscados.`;
  }

  const userInstruction =
    `Complete a seguinte tarefa escolar imitando meu estilo:\n\n` +
    `Título: ${task.title}\n` +
    (task.subject ? `Disciplina: ${task.subject}\n` : "") +
    (task.type ? `Tipo: ${task.type}\n` : "") +
    (task.description ? `\nDescrição da tarefa:\n${task.description}\n` : "") +
    (task.notes ? `\nMinhas anotações:\n${task.notes}\n` : "");

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userInstruction },
    ],
  });

  const raw = response.choices[0]?.message?.content;
  return typeof raw === "string"
    ? raw
    : Array.isArray(raw)
      ? raw.map((p: any) => (typeof p === "string" ? p : p?.text ?? "")).join("")
      : "";
}

export type AutoCompleteResult = { completed: boolean; emailed: boolean };

// Completa a tarefa com IA, salva em completedContent e envia por e-mail
// (se o Gmail estiver configurado). Não marca a tarefa como concluída — deixa
// o usuário revisar e enviar de verdade. Nunca lança: devolve o que rolou.
export async function completeAndEmailTask(userId: number, task: TaskRow): Promise<AutoCompleteResult> {
  const out: AutoCompleteResult = { completed: false, emailed: false };
  try {
    const content = await generateCompletion(userId, task);
    if (!content.trim()) return out;

    await db.updateTask(task.id, userId, { completedContent: content } as any);
    out.completed = true;

    const settings = await db.getIntegrationSettings(userId);
    const user = await db.getUserById(userId);
    const toEmail = settings?.gmailUser || user?.email || "";
    const gmailUser = settings?.gmailUser || undefined;
    const gmailPass = settings?.gmailAppPassword || undefined;

    if (toEmail && gmailUser && gmailPass) {
      await sendCompletedTaskEmail(
        toEmail,
        task.title,
        content,
        gmailUser,
        gmailPass,
        settings?.emailSenderName || undefined
      );
      out.emailed = true;
    }
  } catch (err) {
    console.error(`[AutoComplete] falha na tarefa ${task.id}:`, err);
  }
  return out;
}
