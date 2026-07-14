// Ferramentas do "Jarvis de Estudos" — dão à IA do chat a capacidade de
// REALMENTE executar ações no app (criar tarefas, gerar materiais,
// cronograma), no estilo agêntico do Manus (plan → execute → report).
//
// Duas peças:
//  - AGENT_TOOLS: definições (function schemas) passadas ao invokeLLM.
//  - executeAgentTool(): roda a ação pedida e devolve um resumo textual que
//    volta pro modelo (papel "tool") pra ele relatar ao usuário.

import * as db from "./db";
import { invokeLLM } from "./llm";
import { extractJson } from "./utils/extractJson";
import { syncTaskReminder } from "./reminders";
import { normalize } from "@shared/normalize";

export type ToolResult = { ok: boolean; summary: string; data?: any };

// Schemas expostos ao LLM. Nomes e descrições em PT-BR pra casar com o tom
// do assistente. Mantidos enxutos: só o essencial pra IA agir bem.
export const AGENT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "criar_tarefa",
      description:
        "Cria uma tarefa/atividade escolar do usuário. Use quando ele pedir para adicionar, criar ou anotar uma tarefa, prova, trabalho, projeto ou leitura.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título curto e claro da tarefa" },
          dueDate: {
            type: "string",
            description: "Prazo em ISO (AAAA-MM-DD ou AAAA-MM-DDTHH:mm). Opcional. Converta datas relativas ('sexta', 'amanhã') para a data absoluta.",
          },
          subject: { type: "string", description: "Disciplina/matéria. Opcional." },
          priority: { type: "string", enum: ["baixa", "média", "alta"], description: "Prioridade. Opcional." },
          difficulty: { type: "string", enum: ["fácil", "médio", "difícil"], description: "Dificuldade. Opcional." },
          type: {
            type: "string",
            enum: ["tarefa", "trabalho", "prova", "projeto", "leitura"],
            description: "Tipo. Opcional.",
          },
          description: { type: "string", description: "Detalhes/observações. Opcional." },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "gerar_flashcards",
      description: "Gera flashcards de estudo sobre um tópico e salva no app. Use quando o usuário pedir flashcards.",
      parameters: {
        type: "object",
        properties: {
          topico: { type: "string", description: "Assunto/conteúdo pra gerar os flashcards" },
          subject: { type: "string", description: "Disciplina. Opcional." },
          quantidade: { type: "number", description: "Quantos flashcards (5 a 10). Opcional, padrão 8." },
        },
        required: ["topico"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "gerar_quiz",
      description: "Gera um quiz de múltipla escolha sobre um tópico e salva no app. Use quando o usuário pedir um quiz ou teste.",
      parameters: {
        type: "object",
        properties: {
          topico: { type: "string", description: "Assunto/conteúdo do quiz" },
          subject: { type: "string", description: "Disciplina. Opcional." },
          quantidade: { type: "number", description: "Número de perguntas (1 a 20). Opcional, padrão 5." },
        },
        required: ["topico"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "gerar_guia_estudo",
      description: "Gera um guia de estudo em Markdown sobre um tópico e salva no app. Use quando o usuário pedir um resumo/guia de estudo.",
      parameters: {
        type: "object",
        properties: {
          topico: { type: "string", description: "Assunto/conteúdo do guia" },
          subject: { type: "string", description: "Disciplina. Opcional." },
        },
        required: ["topico"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "gerar_cronograma",
      description: "Gera um cronograma de estudos distribuindo as tarefas pendentes do usuário nos próximos dias. Use quando ele pedir um plano/cronograma de estudos.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "listar_tarefas",
      description: "Lista as tarefas atuais do usuário (título, prazo, status). Use pra ter contexto antes de agir ou quando ele perguntar o que tem pra fazer.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "marcar_tarefa_concluida",
      description:
        "Marca uma tarefa pendente do usuário como concluída, identificando-a pelo título (ou parte dele). Use quando ele disser que terminou/fez uma tarefa.",
      parameters: {
        type: "object",
        properties: {
          titulo: { type: "string", description: "Título (ou trecho) da tarefa que o usuário concluiu" },
        },
        required: ["titulo"],
      },
    },
  },
];

function toDateOrUndefined(value: unknown): Date | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const v = value.trim();
  // Data pura "AAAA-MM-DD": `new Date("2026-07-18")` seria meia-noite UTC,
  // que em pt-BR (UTC-3) exibe como o dia ANTERIOR. Fixamos no MEIO-DIA
  // local pra o prazo cair no dia certo em qualquer fuso do Brasil.
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (dateOnly) {
    const [, y, mo, d] = dateOnly;
    const dt = new Date(Number(y), Number(mo) - 1, Number(d), 12, 0, 0);
    return Number.isFinite(dt.getTime()) ? dt : undefined;
  }
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : undefined;
}

// Executa uma ferramenta pedida pelo modelo. Nunca lança: erros viram um
// ToolResult com ok:false, pra IA conseguir relatar a falha ao usuário.
export async function executeAgentTool(
  name: string,
  args: Record<string, any>,
  userId: number
): Promise<ToolResult> {
  try {
    switch (name) {
      case "criar_tarefa": {
        if (!args.title || !String(args.title).trim()) {
          return { ok: false, summary: "Não criei: faltou o título da tarefa." };
        }
        const created = await db.createTask({
          userId,
          title: String(args.title).slice(0, 255),
          description: args.description ? String(args.description).slice(0, 2000) : undefined,
          dueDate: toDateOrUndefined(args.dueDate),
          difficulty: ["fácil", "médio", "difícil"].includes(args.difficulty) ? args.difficulty : undefined,
          priority: ["baixa", "média", "alta"].includes(args.priority) ? args.priority : undefined,
          type: ["tarefa", "trabalho", "prova", "projeto", "leitura"].includes(args.type) ? args.type : undefined,
          subject: args.subject ? String(args.subject).slice(0, 255) : undefined,
          status: "pendente",
        });
        if (created) await syncTaskReminder(userId, created as any);
        const due = toDateOrUndefined(args.dueDate);
        return {
          ok: true,
          summary:
            `Tarefa criada: "${String(args.title).trim()}"` +
            (args.subject ? ` (${args.subject})` : "") +
            (due ? `, prazo ${due.toLocaleDateString("pt-BR")}` : "") +
            ".",
          data: created,
        };
      }

      case "gerar_flashcards": {
        const topico = String(args.topico || "").trim();
        if (topico.length < 3) return { ok: false, summary: "Não gerei: tópico muito curto." };
        const qtd = Math.max(5, Math.min(10, Number(args.quantidade) || 8));
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content:
                `Você é um gerador de flashcards educacionais em Português (BR). ` +
                `Retorne APENAS um array JSON puro, sem texto, sem markdown. ` +
                `Formato: [{"question": "...", "answer": "...", "difficulty": "fácil"|"médio"|"difícil"}] ` +
                `Gere ${qtd} flashcards de alta qualidade.`,
            },
            { role: "user", content: `Crie flashcards sobre: ${topico}` },
          ],
        });
        const parsed = extractJson<any[]>(response.choices[0]?.message?.content);
        const valid = (Array.isArray(parsed) ? parsed : []).filter(
          (c) => typeof c?.question === "string" && c.question.trim() && typeof c?.answer === "string" && c.answer.trim()
        );
        if (valid.length === 0) return { ok: false, summary: "A IA não conseguiu gerar flashcards dessa vez." };
        for (const card of valid) {
          await db.createFlashcard({
            userId,
            question: card.question,
            answer: card.answer,
            subject: args.subject ? String(args.subject) : undefined,
            difficulty: ["fácil", "médio", "difícil"].includes(card.difficulty) ? card.difficulty : undefined,
          });
        }
        return { ok: true, summary: `${valid.length} flashcards gerados${args.subject ? ` de ${args.subject}` : ""}.`, data: { count: valid.length } };
      }

      case "gerar_quiz": {
        const topico = String(args.topico || "").trim();
        if (topico.length < 3) return { ok: false, summary: "Não gerei: tópico muito curto." };
        const qtd = Math.max(1, Math.min(20, Number(args.quantidade) || 5));
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content:
                `Você é um gerador de quizzes educacionais em Português (BR). ` +
                `Retorne APENAS um objeto JSON puro, sem texto, sem markdown. ` +
                `Formato: {"questions": [{"question": "...", "options": ["A","B","C","D"], "correctAnswer": "A"}]}`,
            },
            { role: "user", content: `Crie um quiz com ${qtd} perguntas sobre: ${topico}` },
          ],
        });
        const parsed = extractJson<{ questions?: any[] }>(response.choices[0]?.message?.content);
        const valid = (Array.isArray(parsed?.questions) ? parsed!.questions : []).filter(
          (q) =>
            typeof q?.question === "string" &&
            q.question.trim() &&
            Array.isArray(q?.options) &&
            q.options.length >= 2 &&
            typeof q?.correctAnswer === "string" &&
            q.correctAnswer.trim()
        );
        if (valid.length === 0) return { ok: false, summary: "A IA não conseguiu gerar o quiz dessa vez." };
        await db.createQuiz({
          userId,
          title: `Quiz: ${args.subject || topico.slice(0, 40)}`,
          subject: args.subject ? String(args.subject) : undefined,
          questions: valid,
          totalQuestions: valid.length,
        });
        return { ok: true, summary: `Quiz de ${valid.length} perguntas gerado${args.subject ? ` de ${args.subject}` : ""}.`, data: { count: valid.length } };
      }

      case "gerar_guia_estudo": {
        const topico = String(args.topico || "").trim();
        if (topico.length < 3) return { ok: false, summary: "Não gerei: tópico muito curto." };
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content:
                `Você é um gerador de guias de estudo em Português (BR). ` +
                `Produza um guia bem estruturado em Markdown com títulos (##), subtópicos (###), ` +
                `listas, e seções "Conceitos-chave", "Exemplos" e "Como estudar". ` +
                `Não use code fence — apenas o Markdown direto.`,
            },
            { role: "user", content: `Crie um guia de estudo sobre: ${topico}` },
          ],
        });
        const raw = response.choices[0]?.message?.content;
        const guide =
          typeof raw === "string"
            ? raw
            : Array.isArray(raw)
              ? raw.map((p: any) => (typeof p === "string" ? p : p?.text ?? "")).join("")
              : "";
        if (!guide.trim()) return { ok: false, summary: "A IA não conseguiu gerar o guia dessa vez." };
        await db.createStudyGuide({
          userId,
          title: `Guia: ${args.subject || topico.slice(0, 40)}`,
          subject: args.subject ? String(args.subject) : undefined,
          content: guide,
        });
        return { ok: true, summary: `Guia de estudo criado${args.subject ? ` de ${args.subject}` : ""}.`, data: { title: `Guia: ${args.subject || topico.slice(0, 40)}` } };
      }

      case "gerar_cronograma": {
        const tasks = await db.getTasksByUserId(userId);
        const pending = tasks.filter((t) => !t.completedAt && t.status !== "concluída");
        if (pending.length === 0) {
          return { ok: false, summary: "Não há tarefas pendentes pra montar um cronograma. Crie tarefas primeiro." };
        }
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content:
                `Você é um planejador de estudos em Português (BR). ` +
                `Retorne APENAS um objeto JSON puro, sem markdown. ` +
                `Formato: {"schedule": [{"date": "AAAA-MM-DD", "subject": "...", "tasks": ["..."], "duration": "1h30"}]} ` +
                `Distribua as tarefas nos próximos 7 dias respeitando prioridade e prazo.`,
            },
            {
              role: "user",
              content: `Crie um cronograma para: ${JSON.stringify(
                pending
                  .slice()
                  .sort((a, b) => {
                    const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
                    const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
                    return ad - bd;
                  })
                  .slice(0, 50)
                  .map((t) => ({ title: t.title, dueDate: t.dueDate, priority: t.priority, subject: t.subject }))
              )}`,
            },
          ],
        });
        const parsed = extractJson<{ schedule?: any[] }>(response.choices[0]?.message?.content);
        const schedule = Array.isArray(parsed?.schedule) ? parsed!.schedule : [];
        if (schedule.length === 0) return { ok: false, summary: "A IA não conseguiu montar o cronograma dessa vez." };
        await db.createStudySchedule({ userId, schedule });
        return { ok: true, summary: `Cronograma gerado com ${schedule.length} dia(s) de estudo.`, data: { days: schedule.length } };
      }

      case "listar_tarefas": {
        const tasks = await db.getTasksByUserId(userId);
        const pending = tasks.filter((t) => t.status !== "concluída");
        const lines = pending
          .slice(0, 30)
          .map((t) => `- ${t.title}${t.subject ? ` (${t.subject})` : ""}${t.dueDate ? `, prazo ${new Date(t.dueDate).toLocaleDateString("pt-BR")}` : ""}`)
          .join("\n");
        return {
          ok: true,
          summary: pending.length === 0 ? "O usuário não tem tarefas pendentes." : `Tarefas pendentes (${pending.length}):\n${lines}`,
          data: { count: pending.length },
        };
      }

      case "marcar_tarefa_concluida": {
        const alvo = normalize(String(args.titulo || ""));
        if (!alvo) return { ok: false, summary: "Não marquei: não informou qual tarefa." };
        const tasks = await db.getTasksByUserId(userId);
        const pendentes = tasks.filter((t) => t.status !== "concluída");
        // Casa por título: primeiro tenta match exato normalizado, senão
        // por conteúdo (a tarefa cujo título contém o texto, ou vice-versa).
        const match =
          pendentes.find((t) => normalize(t.title) === alvo) ||
          pendentes.find((t) => normalize(t.title).includes(alvo) || alvo.includes(normalize(t.title)));
        if (!match) {
          return { ok: false, summary: `Não achei uma tarefa pendente que combine com "${args.titulo}".` };
        }
        await db.updateTask(match.id, userId, { status: "concluída", completedAt: new Date() } as any);
        await db.deleteUnsentRemindersForTask(userId, match.id);
        return { ok: true, summary: `Tarefa "${match.title}" marcada como concluída. 🎉`, data: { id: match.id } };
      }

      default:
        return { ok: false, summary: `Ferramenta desconhecida: ${name}.` };
    }
  } catch (err: any) {
    console.error(`[AgentTool] falha em ${name}:`, err);
    return { ok: false, summary: `Erro ao executar ${name}: ${String(err?.message ?? err)}` };
  }
}
