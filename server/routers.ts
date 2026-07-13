import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { TRPCError } from "@trpc/server";
import { sendTestEmail } from "./email";

/**
 * Extrai um objeto/array JSON de uma resposta bruta do LLM.
 * Cobre casos comuns: JSON puro, cercado por ```json ... ```, ou
 * misturado com texto antes/depois. Retorna null se nao achar
 * nada parseavel — nunca lanca.
 */
function extractJson<T = unknown>(raw: unknown): T | null {
  const str =
    typeof raw === "string"
      ? raw
      : Array.isArray(raw)
        ? raw.map((p: any) => (typeof p === "string" ? p : p?.text ?? "")).join("")
        : String(raw ?? "");
  if (!str) return null;

  // Tentativa 1: JSON puro
  try {
    return JSON.parse(str) as T;
  } catch {}

  // Tentativa 2: fenced code block ```json ... ``` ou ``` ... ```
  const fenced = str.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    try {
      return JSON.parse(fenced[1].trim()) as T;
    } catch {}
  }

  // Tentativa 3: primeiro { ... } ou [ ... ] balanceado
  const firstArray = str.indexOf("[");
  const firstObject = str.indexOf("{");
  const start =
    firstArray === -1
      ? firstObject
      : firstObject === -1
        ? firstArray
        : Math.min(firstArray, firstObject);
  if (start >= 0) {
    const open = str[start];
    const close = open === "[" ? "]" : "}";
    let depth = 0;
    for (let i = start; i < str.length; i++) {
      if (str[i] === open) depth++;
      else if (str[i] === close) {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(str.slice(start, i + 1)) as T;
          } catch {}
          break;
        }
      }
    }
  }
  return null;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  preferences: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserPreferences(ctx.user.id);
    }),
    update: protectedProcedure
      .input(z.object({
        smtpEmail: z.string().email().optional(),
        smtpPassword: z.string().optional(),
        smtpHost: z.string().optional(),
        smtpPort: z.number().optional(),
        whatsappNumber: z.string().optional(),
        whatsappApiKey: z.string().optional(),
        aiStyle: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.upsertUserPreferences(ctx.user.id, input);
        return await db.getUserPreferences(ctx.user.id);
      }),
  }),

  tasks: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getTasksByUserId(ctx.user.id);
    }),
    create: protectedProcedure
      .input(z.object({
        title: z.string(),
        description: z.string().optional(),
        dueDate: z.date().optional(),
        difficulty: z.enum(["fácil", "médio", "difícil"]).optional(),
        priority: z.enum(["baixa", "média", "alta"]).optional(),
        type: z.enum(["tarefa", "trabalho", "prova", "projeto", "leitura"]).optional(),
        subject: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.createTask({
          userId: ctx.user.id,
          ...input,
          status: "pendente",
        });
        return result;
      }),
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getTaskById(input.id, ctx.user.id);
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        dueDate: z.date().optional(),
        difficulty: z.enum(["fácil", "médio", "difícil"]).optional(),
        priority: z.enum(["baixa", "média", "alta"]).optional(),
        status: z.enum(["pendente", "em_progresso", "concluída", "atrasada"]).optional(),
        type: z.enum(["tarefa", "trabalho", "prova", "projeto", "leitura"]).optional(),
        subject: z.string().optional(),
        notes: z.string().optional(),
        completedContent: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...updates } = input;
        await db.updateTask(id, ctx.user.id, updates);
        return await db.getTaskById(id, ctx.user.id);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteTask(input.id, ctx.user.id);
        return { success: true };
      }),
    upcoming: protectedProcedure
      .input(z.object({ daysAhead: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        return await db.getUpcomingTasks(ctx.user.id, input.daysAhead || 7);
      }),
  }),

  conversations: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getConversationsByUserId(ctx.user.id);
    }),
    create: protectedProcedure
      .input(z.object({
        title: z.string().optional(),
        taskId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.createConversation({
          userId: ctx.user.id,
          title: input.title || "Nova Conversa",
          messages: [],
          taskId: input.taskId,
        });
        return result;
      }),
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getConversationById(input.id, ctx.user.id);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteConversation(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  chat: router({
    message: protectedProcedure
      .input(z.object({
        conversationId: z.number(),
        message: z.string(),
        fileUrls: z.array(z.object({
          url: z.string(),
          type: z.enum(["image", "document", "audio"]),
        })).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const conv = await db.getConversationById(input.conversationId, ctx.user.id);
        if (!conv) throw new TRPCError({ code: "NOT_FOUND" });

        const prefs = await db.getUserPreferences(ctx.user.id);
        const memories = await db.getUserMemoriesByUserId(ctx.user.id);
        const messages: any[] = (Array.isArray(conv.messages) ? conv.messages : []) || [];

        // Se a conversa foi criada a partir de uma tarefa (conv.taskId),
        // puxa dados atuais dela para injetar no system prompt.
        let taskContext: any = null;
        if (conv.taskId) {
          taskContext = await db.getTaskById(conv.taskId, ctx.user.id);
        }

        // Guardamos a mensagem do usuário como TEXTO PLANO no histórico —
        // o array multimodal só é usado na chamada ao LLM abaixo. Isso evita
        // que o usuário veja JSON bruto ao reabrir a conversa.
        messages.push({
          role: "user",
          content: input.message,
          attachments: input.fileUrls ?? [],
          timestamp: new Date(),
        });

        let systemPrompt = `Você é um assistente de estudos inteligente e atencioso. Responda sempre em Português (BR). Ajude o usuário a entender conceitos, resolver problemas passo a passo, criar resumos e estudar de forma eficaz. Seja conciso mas completo, use exemplos práticos quando apropriado.`;

        if (prefs?.aiStyle) {
          systemPrompt += `\n\nEstilo preferido do usuário: ${prefs.aiStyle}`;
        }

        if (taskContext) {
          systemPrompt += `\n\nEsta conversa está associada à tarefa do usuário:\n`;
          systemPrompt += `- Título: ${taskContext.title}\n`;
          if (taskContext.subject) systemPrompt += `- Disciplina: ${taskContext.subject}\n`;
          if (taskContext.type) systemPrompt += `- Tipo: ${taskContext.type}\n`;
          if (taskContext.dueDate)
            systemPrompt += `- Prazo: ${new Date(taskContext.dueDate).toLocaleDateString("pt-BR")}\n`;
          if (taskContext.description)
            systemPrompt += `- Descrição: ${taskContext.description}\n`;
          if (taskContext.notes)
            systemPrompt += `- Anotações do usuário: ${taskContext.notes}\n`;
          systemPrompt += `\nUse esse contexto para ajudar a resolver ou completar essa tarefa específica.`;
        }

        if (memories && memories.length > 0) {
          systemPrompt += `\n\nMemórias e referências do usuário para personalização:\n`;
          for (const memory of memories.slice(0, 5)) {
            systemPrompt += `\n- ${memory.title}${memory.category ? ` (${memory.category})` : ''}: ${memory.content.substring(0, 300)}...`;
          }
          systemPrompt += `\n\nUse essas memórias para adaptar seu tom, estilo, abordagem e forma de responder.`;
        }

        // Monta o payload multimodal SÓ para a chamada ao LLM.
        const llmMessages = [
          { role: "system" as const, content: systemPrompt },
          ...messages.map((m) => {
            if (m.role === "user" && Array.isArray(m.attachments) && m.attachments.length > 0) {
              const parts: any[] = [{ type: "text", text: m.content }];
              for (const file of m.attachments) {
                if (file.type === "image") {
                  parts.push({ type: "image_url", image_url: { url: file.url, detail: "auto" } });
                } else if (file.type === "document" || file.type === "audio") {
                  parts.push({
                    type: "file_url",
                    file_url: {
                      url: file.url,
                      mime_type: file.type === "audio" ? "audio/mpeg" : "application/pdf",
                    },
                  });
                }
              }
              return { role: m.role, content: parts };
            }
            return { role: m.role, content: m.content };
          }),
        ];

        const response = await invokeLLM({ messages: llmMessages });

        const raw = response.choices[0]?.message?.content;
        const assistantMessage =
          typeof raw === "string"
            ? raw
            : Array.isArray(raw)
              ? raw.map((p: any) => (typeof p === "string" ? p : p?.text ?? "")).join("")
              : "";

        messages.push({ role: "assistant", content: assistantMessage, timestamp: new Date() });

        // Se era a primeira troca do usuário e o título ainda é o padrão
        // "Nova Conversa", renomeia com as primeiras palavras da mensagem.
        // Evita ter 15 conversas todas chamadas "Nova Conversa" na sidebar.
        const isFirstUserMessage = messages.filter((m) => m.role === "user").length === 1;
        const hasDefaultTitle = !conv.title || conv.title === "Nova Conversa";
        const patch: any = { messages };
        if (isFirstUserMessage && hasDefaultTitle) {
          const derived = input.message.trim().slice(0, 60).replace(/\s+/g, " ");
          if (derived) {
            patch.title = derived + (input.message.length > 60 ? "…" : "");
          }
        }
        await db.updateConversation(input.conversationId, ctx.user.id, patch);

        return {
          conversationId: input.conversationId,
          message: assistantMessage,
        };
      }),

    // Completa uma tarefa imitando o estilo do usuário. Cria uma NOVA
    // conversa dedicada, chama o LLM com memórias como contexto, e
    // salva o resultado no campo completedContent da tarefa (que já
    // existe no schema).
    completeTask: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const task = await db.getTaskById(input.taskId, ctx.user.id);
        if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Tarefa não encontrada" });

        const prefs = await db.getUserPreferences(ctx.user.id);
        const memories = await db.getUserMemoriesByUserId(ctx.user.id);

        let systemPrompt =
          `Você é o próprio usuário completando uma tarefa escolar. Escreva na primeira pessoa e imite fielmente o estilo, tom e vocabulário do usuário conforme mostrado nas memórias.\n` +
          `Nunca mencione que é IA, nunca comente sobre a tarefa em terceira pessoa. Apenas produza o texto/resposta final como se fosse o usuário. Responda em Português (BR).`;

        if (prefs?.aiStyle) {
          systemPrompt += `\n\nEstilo preferido: ${prefs.aiStyle}`;
        }

        if (memories && memories.length > 0) {
          systemPrompt += `\n\nAmostras do estilo de escrita do usuário (imite palavra por palavra a forma de escrever):\n`;
          for (const memory of memories.slice(0, 5)) {
            systemPrompt += `\n--- ${memory.title}${memory.category ? ` (${memory.category})` : ""} ---\n${memory.content.substring(0, 800)}\n`;
          }
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
        const result =
          typeof raw === "string"
            ? raw
            : Array.isArray(raw)
              ? raw.map((p: any) => (typeof p === "string" ? p : p?.text ?? "")).join("")
              : "";

        // Salva no próprio task para o usuário revisitar depois.
        await db.updateTask(input.taskId, ctx.user.id, {
          completedContent: result,
        });

        return {
          taskId: input.taskId,
          content: result,
        };
      }),
  }),

  flashcards: router({
    list: protectedProcedure
      .input(z.object({ deckId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        if (input.deckId) {
          return await db.getFlashcardsByDeckId(input.deckId, ctx.user.id);
        }
        return await db.getFlashcardsByUserId(ctx.user.id);
      }),
    create: protectedProcedure
      .input(z.object({
        deckId: z.number().optional(),
        question: z.string(),
        answer: z.string(),
        subject: z.string().optional(),
        difficulty: z.enum(["fácil", "médio", "difícil"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.createFlashcard({
          userId: ctx.user.id,
          ...input,
        });
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteFlashcard(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  decks: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getFlashcardDecksByUserId(ctx.user.id);
    }),
    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        description: z.string().optional(),
        subject: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.createFlashcardDeck({
          userId: ctx.user.id,
          ...input,
        });
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteFlashcardDeck(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  quizzes: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getQuizzesByUserId(ctx.user.id);
    }),
  }),

  studyGuides: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getStudyGuidesByUserId(ctx.user.id);
    }),
  }),

  studyTools: router({
    generateFlashcards: protectedProcedure
      .input(z.object({
        content: z.string(),
        subject: z.string().optional(),
        deckId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content:
                `Você é um gerador de flashcards educacionais em Português (BR). ` +
                `Retorne APENAS um array JSON puro, sem texto, sem markdown, sem cerca de código. ` +
                `Formato: [{"question": "...", "answer": "...", "difficulty": "fácil"|"médio"|"difícil"}] ` +
                `Gere entre 5 e 10 flashcards de alta qualidade.`,
            },
            {
              role: "user",
              content: `Crie flashcards sobre: ${input.content}`,
            },
          ],
        });

        const parsed = extractJson<any[]>(response.choices[0]?.message?.content);
        const flashcards = Array.isArray(parsed) ? parsed : [];

        const created = [];
        for (const card of flashcards) {
          const result = await db.createFlashcard({
            userId: ctx.user.id,
            deckId: input.deckId,
            question: card.question,
            answer: card.answer,
            subject: input.subject,
            difficulty: card.difficulty,
          });
          created.push(result);
        }

        return { created: created.length, flashcards: created };
      }),

    generateQuiz: protectedProcedure
      .input(z.object({
        content: z.string(),
        subject: z.string().optional(),
        questionCount: z.number().default(5),
      }))
      .mutation(async ({ ctx, input }) => {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content:
                `Você é um gerador de quizzes educacionais em Português (BR). ` +
                `Retorne APENAS um objeto JSON puro, sem texto, sem markdown. ` +
                `Formato: {"questions": [{"question": "...", "options": ["A", "B", "C", "D"], "correctAnswer": "A"}]}`,
            },
            {
              role: "user",
              content: `Crie um quiz com ${input.questionCount} perguntas sobre: ${input.content}`,
            },
          ],
        });

        const parsed = extractJson<{ questions?: any[] }>(response.choices[0]?.message?.content);
        const quizData = {
          questions: Array.isArray(parsed?.questions) ? parsed.questions : [],
        };

        return await db.createQuiz({
          userId: ctx.user.id,
          title: `Quiz: ${input.subject || "Sem título"}`,
          subject: input.subject,
          questions: quizData.questions,
          totalQuestions: quizData.questions.length,
        });
      }),

    generateStudyGuide: protectedProcedure
      .input(z.object({
        content: z.string(),
        subject: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `Você é um gerador de guias de estudo. Crie um guia bem estruturado em Markdown.`,
            },
            {
              role: "user",
              content: `Crie um guia de estudo sobre: ${input.content}`,
            },
          ],
        });

        const guideContent = response.choices[0]?.message?.content || "";
        const guideStr = typeof guideContent === 'string' ? guideContent : JSON.stringify(guideContent);

        return await db.createStudyGuide({
          userId: ctx.user.id,
          title: `Guia: ${input.subject || "Sem título"}`,
          subject: input.subject,
          content: guideStr,
        });
      }),
  }),

  schedule: router({
    generate: protectedProcedure.mutation(async ({ ctx }) => {
      const tasks = await db.getTasksByUserId(ctx.user.id);
      
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              `Você é um planejador de estudos em Português (BR). ` +
              `Retorne APENAS um objeto JSON puro, sem texto, sem markdown. ` +
              `Formato: {"schedule": [{"date": "AAAA-MM-DD", "subject": "...", "tasks": ["..."], "duration": "1h30"}]} ` +
              `Distribua as tarefas nos próximos 7 dias respeitando prioridade e data de entrega.`,
          },
          {
            role: "user",
            content: `Crie um cronograma para estas tarefas: ${JSON.stringify(
              tasks
                .filter((t) => !t.completedAt)
                .map((t) => ({ title: t.title, dueDate: t.dueDate, priority: t.priority, subject: t.subject }))
            )}`,
          },
        ],
      });

      const parsed = extractJson<{ schedule?: any[] }>(response.choices[0]?.message?.content);
      const scheduleData = {
        schedule: Array.isArray(parsed?.schedule) ? parsed.schedule : [],
      };

      return await db.createStudySchedule({
        userId: ctx.user.id,
        schedule: scheduleData.schedule,
      });
    }),

    get: protectedProcedure.query(async ({ ctx }) => {
      return await db.getLatestStudySchedule(ctx.user.id);
    }),
  }),

  upload: router({
    file: protectedProcedure
      .input(z.object({
        fileName: z.string(),
        fileData: z.string(),
        mimeType: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const buffer = Buffer.from(input.fileData, "base64");
        const fileKey = `${ctx.user.id}-files/${Date.now()}-${input.fileName}`;
        
        const { key, url } = await storagePut(fileKey, buffer, input.mimeType);
        
        return { key, url, fileName: input.fileName };
      }),
  }),

  memories: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserMemoriesByUserId(ctx.user.id);
    }),
    create: protectedProcedure
      .input(z.object({
        title: z.string(),
        category: z.string().optional(),
        content: z.string(),
        source: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.createUserMemory({
          userId: ctx.user.id,
          ...input,
        });
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        category: z.string().optional(),
        content: z.string().optional(),
        source: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...updates } = input;
        await db.updateUserMemory(id, ctx.user.id, updates);
        return await db.getUserMemoryById(id, ctx.user.id);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteUserMemory(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  reminders: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getEmailRemindersByUserId(ctx.user.id);
    }),
    create: protectedProcedure
      .input(z.object({
        taskId: z.number(),
        reminderTime: z.date(),
      }))
      .mutation(async ({ ctx, input }) => {
        const task = await db.getTaskById(input.taskId, ctx.user.id);
        if (!task) throw new TRPCError({ code: "NOT_FOUND" });

        return await db.createEmailReminder({
          userId: ctx.user.id,
          taskId: input.taskId,
          reminderTime: input.reminderTime,
          sent: false,
        });
      }),
  }),

  integrationSettings: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      return await db.getIntegrationSettings(ctx.user.id);
    }),
    update: protectedProcedure
      .input(z.object({
        emailSenderEmail: z.string().optional(),
        whatsappPhoneNumber: z.string().optional(),
        toddleEmail: z.string().optional(),
        toddlePassword: z.string().optional(),
        toddleProvider: z.string().optional(),
        gmailUser: z.string().optional(),
        gmailAppPassword: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.createOrUpdateIntegrationSettings(ctx.user.id, input);
      }),
  }),

  toddle: router({
    // Sync real ainda não implementado. Endpoint existe pra que o botão
    // "Sincronizar" tenha um destino de verdade — retorna erro claro em
    // vez de fingir sucesso. Assim que o parser do Toddle estiver pronto,
    // é só substituir o corpo deste handler.
    sync: protectedProcedure.mutation(async ({ ctx }) => {
      const settings = await db.getIntegrationSettings(ctx.user.id);
      if (!settings?.toddleEmail || !settings?.toddlePassword) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Configure suas credenciais do Toddle em Configurações antes de sincronizar.",
        });
      }
      // TODO(toddle-sync): implementar autenticação e parser das tarefas
      // por provedor (Lex Brasil, Toddle Direct, Google, Microsoft).
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message:
          "Sincronização automática com Toddle ainda não está disponível para o provedor " +
          (settings.toddleProvider || "configurado") +
          ". Enquanto isso, crie tarefas manualmente ou aguarde a próxima atualização.",
      });
    }),
  }),

  email: router({
    sendTest: protectedProcedure
      .input(z.object({
        toEmail: z.string().email(),
      }))
      .mutation(async ({ ctx, input }) => {
        const integrationSettings = await db.getIntegrationSettings(ctx.user.id);
        return await sendTestEmail(input.toEmail, integrationSettings?.gmailUser || undefined, integrationSettings?.gmailAppPassword || undefined);
      }),

    // Envia o conteúdo gerado pela IA (completedContent da tarefa) para
    // o email do usuário. Usado depois do "Completar com IA" pra ele
    // receber o texto no email e imprimir/entregar.
    sendCompletedTask: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const task = await db.getTaskById(input.taskId, ctx.user.id);
        if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Tarefa não encontrada" });
        if (!task.completedContent) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Esta tarefa não tem conteúdo gerado. Use 'Completar com IA' primeiro.",
          });
        }

        const settings = await db.getIntegrationSettings(ctx.user.id);
        if (!settings?.emailSenderEmail) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Configure seu email em Configurações antes de enviar.",
          });
        }
        if (!settings.gmailUser || !settings.gmailAppPassword) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Configure seu Gmail (email + senha de app) em Configurações.",
          });
        }

        const { sendCompletedTaskEmail } = await import("./email");
        return await sendCompletedTaskEmail(
          settings.emailSenderEmail,
          task.title,
          task.completedContent,
          settings.gmailUser,
          settings.gmailAppPassword
        );
      }),
  }),
});

export type AppRouter = typeof appRouter;
