// Pipeline autônomo: a IA COMPLETA uma tarefa imitando o estilo do usuário
// (mesma lógica do chat.completeTask) e ENVIA o resultado por e-mail. Usado
// pela sincronização automática do Toddle quando a automação está ligada.
// Sem interação: roda no cron, no estilo do próprio usuário.

import * as db from "./db";
import { invokeLLM } from "./llm";
import { sendCompletedTaskEmail } from "./email";
import { llmText } from "./utils/llmText";
import { resolveExternalUrl } from "./storage";

// Máximo de imagens de memória incluídas no prompt multimodal. Fotos
// altas de atividade custam muitos tokens; 4 já dá amostra visual boa
// do estilo/letra sem quebrar o context.
const MEMORY_IMAGES_LIMIT = 4;

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

  // Colhe URLs de imagens das memórias pra passar como referência visual
  // multimodal. Cap global (MEMORY_IMAGES_LIMIT) — 4 fotos já dão amostra
  // suficiente do estilo/letra sem estourar tokens.
  const memoryImageUrls: string[] = [];
  if (memories && memories.length > 0) {
    systemPrompt += `\n\nAmostras do estilo de escrita do usuário (imite a forma de escrever):\n`;
    for (const memory of memories.slice(0, 5)) {
      systemPrompt += `\n--- ${memory.title}${memory.category ? ` (${memory.category})` : ""} ---\n${String(memory.content).substring(0, 800)}\n`;
      if (Array.isArray((memory as any).imageUrls)) {
        for (const url of (memory as any).imageUrls as unknown[]) {
          if (typeof url === "string" && url && memoryImageUrls.length < MEMORY_IMAGES_LIMIT) {
            memoryImageUrls.push(url);
          }
        }
      }
    }
    if (memoryImageUrls.length > 0) {
      systemPrompt +=
        `\n\nVocê vai receber ${memoryImageUrls.length} foto(s) de atividades ` +
        `respondidas pelo usuário. IMITE a caligrafia (se manuscrita), o formato ` +
        `de resposta, uso de setinhas/esquemas, e o nível de detalhamento.`;
    }
  } else {
    systemPrompt +=
      `\n\nSem memórias do estilo do usuário: escreva em tom natural de estudante brasileiro, ` +
      `direto e claro, frases de tamanho médio, sem gírias exageradas nem termos rebuscados.`;
  }

  const instructionText =
    `Complete a seguinte tarefa escolar imitando meu estilo:\n\n` +
    `Título: ${task.title}\n` +
    (task.subject ? `Disciplina: ${task.subject}\n` : "") +
    (task.type ? `Tipo: ${task.type}\n` : "") +
    (task.description ? `\nDescrição da tarefa:\n${task.description}\n` : "") +
    (task.notes ? `\nMinhas anotações:\n${task.notes}\n` : "");

  // Monta content: string simples quando não há imagens (compat com todos
  // os providers), ou array multimodal quando há.
  let userContent: any = instructionText;
  if (memoryImageUrls.length > 0) {
    const parts: any[] = [{ type: "text", text: instructionText }];
    for (const url of memoryImageUrls) {
      // Resolve pra URL absoluta (o LLM baixa direto do S3, não do host).
      const external = await resolveExternalUrl(url);
      parts.push({ type: "image_url", image_url: { url: external, detail: "auto" } });
    }
    userContent = parts;
  }

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
  });

  return llmText(response.choices[0]?.message?.content);
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
