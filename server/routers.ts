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

        const content: any[] = [{ type: "text", text: input.message }];
        if (input.fileUrls) {
          for (const file of input.fileUrls) {
            if (file.type === "image") {
              content.push({
                type: "image_url",
                image_url: { url: file.url, detail: "auto" },
              });
            } else if (file.type === "document" || file.type === "audio") {
              content.push({
                type: "file_url",
                file_url: {
                  url: file.url,
                  mime_type: file.type === "audio" ? "audio/mpeg" : "application/pdf",
                },
              });
            }
          }
        }

        messages.push({ role: "user", content: typeof content === 'string' ? content : JSON.stringify(content), timestamp: new Date() });

        let systemPrompt = `Você é um assistente de estudos inteligente e atencioso. Responda sempre em Português (BR). Ajude o usuário a entender conceitos, resolver problemas passo a passo, criar resumos e estudar de forma eficaz. Seja conciso mas completo, use exemplos práticos quando apropriado.`;

        if (prefs?.aiStyle) {
          systemPrompt += `\n\nEstilo preferido do usuário: ${prefs.aiStyle}`;
        }

        if (memories && memories.length > 0) {
          systemPrompt += `\n\nMemórias e referências do usuário para personalização:\n`;
          for (const memory of memories.slice(0, 5)) {
            systemPrompt += `\n- ${memory.title}${memory.category ? ` (${memory.category})` : ''}: ${memory.content.substring(0, 300)}...`;
          }
          systemPrompt += `\n\nUse essas memórias para adaptar seu tom, estilo, abordagem e forma de responder.`;
        }

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            ...messages.map(m => ({ role: m.role, content: m.content })),
          ],
        });

        const assistantMessage = response.choices[0]?.message?.content || "";
        const assistantContent = typeof assistantMessage === 'string' ? assistantMessage : JSON.stringify(assistantMessage);
        messages.push({ role: "assistant", content: assistantContent, timestamp: new Date() });

        await db.updateConversation(input.conversationId, ctx.user.id, { messages });

        return {
          conversationId: input.conversationId,
          message: typeof assistantMessage === 'string' ? assistantMessage : JSON.stringify(assistantMessage),
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
              content: `Você é um gerador de flashcards educacionais. Crie flashcards em formato JSON com a seguinte estrutura: [{"question": "...", "answer": "...", "difficulty": "fácil|médio|difícil"}] Crie entre 5 e 10 flashcards de alta qualidade sobre o conteúdo fornecido.`,
            },
            {
              role: "user",
              content: `Crie flashcards sobre: ${input.content}`,
            },
          ],
        });

        const content = response.choices[0]?.message?.content;
        let flashcards = [];
        try {
          const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
          flashcards = JSON.parse(contentStr || "[]");
        } catch (e) {
          flashcards = [];
        }

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
              content: `Você é um gerador de quizzes. Retorne um JSON com array de perguntas.`,
            },
            {
              role: "user",
              content: `Crie um quiz com ${input.questionCount} perguntas sobre: ${input.content}`,
            },
          ],
        });

        const content = response.choices[0]?.message?.content;
        const quizData = { questions: [] };
        try {
          const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
          const parsed = JSON.parse(contentStr || "{}");
          if (parsed.questions) quizData.questions = parsed.questions;
        } catch (e) {
          // fallback
        }

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
            content: `Você é um planejador de estudos inteligente. Crie um cronograma de estudos personalizado em formato JSON.`,
          },
          {
            role: "user",
            content: `Crie um cronograma para estas tarefas: ${JSON.stringify(tasks.map(t => ({ title: t.title, dueDate: t.dueDate, priority: t.priority })))}`,
          },
        ],
      });

      const scheduleData = { schedule: [] };
      const content = response.choices[0]?.message?.content;
      try {
        const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
        const parsed = JSON.parse(contentStr || "{}");
        if (parsed.schedule) scheduleData.schedule = parsed.schedule;
      } catch (e) {
        // fallback
      }

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

  email: router({
    sendTest: protectedProcedure
      .input(z.object({
        toEmail: z.string().email(),
      }))
      .mutation(async ({ ctx, input }) => {
        const integrationSettings = await db.getIntegrationSettings(ctx.user.id);
        return await sendTestEmail(input.toEmail, integrationSettings?.gmailUser || undefined, integrationSettings?.gmailAppPassword || undefined);
      }),
  }),
});

export type AppRouter = typeof appRouter;
