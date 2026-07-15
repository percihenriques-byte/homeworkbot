import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { invokeLLM } from "./llm";
import { storagePut, resolveExternalUrl } from "./storage";
import { TRPCError } from "@trpc/server";
import { sendTestEmail, sendCompletedTaskEmail } from "./email";
import { extractJson } from "./utils/extractJson";
import { parseIcs } from "./utils/parseIcs";
import { syncTaskReminder } from "./reminders";
import { AGENT_TOOLS, executeAgentTool } from "./agentTools";
import { syncToddleForUser } from "./toddleSync";
import { friendlyEmailError } from "./utils/friendlyEmailError";
import { generateCompletion } from "./autoComplete";
import { buildChatSystemPrompt } from "./chatPrompt";

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
        // Aceita "" (clear) ou email valido. Antes rejeitava "" com
        // "invalid email" — nao dava pra limpar o campo depois de setar.
        smtpEmail: z.union([z.literal(""), z.string().email({ message: "Formato de email inválido" })]).optional(),
        smtpPassword: z.string().max(500).optional(),
        smtpHost: z.string().max(255).optional(),
        smtpPort: z.number().int().min(1).max(65535).optional(),
        whatsappNumber: z.string().max(20).optional(),
        whatsappApiKey: z.string().max(500).optional(),
        aiStyle: z.string().max(2000).optional(),
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
        title: z.string().min(1, "Título é obrigatório").max(255),
        description: z.string().max(2000).optional(),
        dueDate: z.date().optional(),
        difficulty: z.enum(["fácil", "médio", "difícil"]).optional(),
        priority: z.enum(["baixa", "média", "alta"]).optional(),
        type: z.enum(["tarefa", "trabalho", "prova", "projeto", "leitura"]).optional(),
        subject: z.string().max(255).optional(),
        notes: z.string().max(5000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.createTask({
          userId: ctx.user.id,
          ...input,
          status: "pendente",
        });
        // Agenda o lembrete por e-mail (24h antes do prazo) se houver dueDate.
        if (result) await syncTaskReminder(ctx.user.id, result as any);
        return result;
      }),
    get: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        return await db.getTaskById(input.id, ctx.user.id);
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().max(2000).optional(),
        // dueDate accepts Date to set, null to clear, undefined to leave alone.
        dueDate: z.date().nullable().optional(),
        difficulty: z.enum(["fácil", "médio", "difícil"]).optional(),
        priority: z.enum(["baixa", "média", "alta"]).optional(),
        status: z.enum(["pendente", "em_progresso", "concluída", "atrasada"]).optional(),
        type: z.enum(["tarefa", "trabalho", "prova", "projeto", "leitura"]).optional(),
        subject: z.string().max(255).optional(),
        notes: z.string().max(5000).optional(),
        completedContent: z.string().max(50000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...updates } = input;
        // Server toca completedAt sozinho quando o status muda pra
        // concluida. Assim o UI nao precisa mandar timestamp nem lidar
        // com fuso — o servidor e a fonte da verdade.
        const patch: any = { ...updates };
        if (updates.status === "concluída") {
          patch.completedAt = new Date();
        } else if (updates.status) {
          // Reabriu a tarefa (qualquer status != concluída): limpa o completedAt.
          patch.completedAt = null;
        }
        await db.updateTask(id, ctx.user.id, patch);
        const updated = await db.getTaskById(id, ctx.user.id);
        // Reagenda (ou cancela) o lembrete conforme o novo prazo/status.
        await syncTaskReminder(ctx.user.id, updated as any);
        return updated;
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        // Remove lembretes pendentes antes de apagar a tarefa.
        await db.deleteUnsentRemindersForTask(ctx.user.id, input.id);
        await db.deleteTask(input.id, ctx.user.id);
        return { success: true };
      }),
    upcoming: protectedProcedure
      .input(z.object({ daysAhead: z.number().int().min(1).max(365).optional() }))
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
        title: z.string().max(255).optional(),
        taskId: z.number().int().positive().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Se taskId veio, valida que a tarefa existe e pertence ao user.
        // Antes qualquer taskId era aceito — se o cliente forjasse um id
        // fora do escopo, criava conversa "linkada" a nada (ou ao id de
        // outro usuario, o que seria vazamento no chat.message quando
        // for buscar taskContext).
        if (input.taskId !== undefined) {
          const task = await db.getTaskById(input.taskId, ctx.user.id);
          if (!task) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Tarefa vinculada não encontrada.",
            });
          }
        }
        const result = await db.createConversation({
          userId: ctx.user.id,
          title: input.title || "Nova Conversa",
          messages: [],
          taskId: input.taskId,
        });
        return result;
      }),
    get: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        return await db.getConversationById(input.id, ctx.user.id);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteConversation(input.id, ctx.user.id);
        return { success: true };
      }),
    rename: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), title: z.string().min(1).max(255) }))
      .mutation(async ({ ctx, input }) => {
        await db.updateConversation(input.id, ctx.user.id, { title: input.title });
        return await db.getConversationById(input.id, ctx.user.id);
      }),
  }),

  chat: router({
    message: protectedProcedure
      .input(z.object({
        conversationId: z.number().int().positive(),
        message: z.string().max(10000, "Mensagem muito longa (limite 10.000 caracteres)"),
        fileUrls: z
          .array(
            z.object({
              // URL pode ser absoluta (https://...) ou relativa
              // (/manus-storage/...) — não usa .url() estrito.
              url: z.string().min(1).max(2000),
              type: z.enum(["image", "document", "audio"]),
              // Mime real do arquivo (ex: "audio/ogg", "image/png").
              // Opcional para compatibilidade com anexos antigos que só
              // guardavam type. Quando presente, é usado direto no payload
              // multimodal em vez de um mime genérico chutado pelo type.
              mimeType: z.string().max(255).optional(),
            })
          )
          .max(10, "Máximo 10 arquivos por mensagem")
          .optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const conv = await db.getConversationById(input.conversationId, ctx.user.id);
        if (!conv) throw new TRPCError({ code: "NOT_FOUND", message: "Conversa não encontrada" });

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

        const systemPrompt = buildChatSystemPrompt({
          aiStyle: prefs?.aiStyle ?? null,
          task: taskContext,
          memories: memories ?? [],
        });

        // Limita o payload enviado ao LLM às últimas N mensagens.
        // Conversas longas eram enviadas por inteiro — custava caro e
        // podia estourar o context window do modelo. 20 mensagens (10
        // rodadas usuário↔assistente) cobre praticamente qualquer
        // troca útil sem perder contexto imediato.
        const MAX_CONTEXT_MESSAGES = 20;
        const contextMessages = messages.slice(-MAX_CONTEXT_MESSAGES);

        // Monta o payload multimodal SÓ para a chamada ao LLM.
        // As URLs dos anexos ficam salvas como path relativo /manus-storage/,
        // que só resolve no host do Manus. O provedor do LLM baixa a URL do
        // seu próprio servidor, então resolvemos cada anexo para uma URL
        // absoluta pré-assinada (resolveExternalUrl) antes de enviar.
        const mappedMessages = await Promise.all(
          contextMessages.map(async (m) => {
            if (m.role === "user" && Array.isArray(m.attachments) && m.attachments.length > 0) {
              const parts: any[] = [{ type: "text", text: m.content }];
              for (const file of m.attachments) {
                const externalUrl = await resolveExternalUrl(file.url);
                if (file.type === "image") {
                  parts.push({ type: "image_url", image_url: { url: externalUrl, detail: "auto" } });
                } else if (file.type === "document" || file.type === "audio") {
                  // Usa o mime real do arquivo quando disponível (.wav, .ogg,
                  // .docx, etc). Só cai no genérico por tipo se o anexo antigo
                  // não tiver mimeType salvo.
                  const fallbackMime = file.type === "audio" ? "audio/mpeg" : "application/pdf";
                  parts.push({
                    type: "file_url",
                    file_url: {
                      url: externalUrl,
                      mime_type: file.mimeType || fallbackMime,
                    },
                  });
                }
              }
              return { role: m.role, content: parts };
            }
            return { role: m.role, content: m.content };
          })
        );
        const llmMessages = [
          { role: "system" as const, content: systemPrompt },
          ...mappedMessages,
        ];

        const textOf = (raw: any): string =>
          typeof raw === "string"
            ? raw
            : Array.isArray(raw)
              ? raw.map((p: any) => (typeof p === "string" ? p : p?.text ?? "")).join("")
              : "";

        // Primeira chamada COM ferramentas: o modelo decide se age (criar
        // tarefa, gerar material...) ou só responde. toolChoice "auto".
        // Rede de segurança: se o provedor falhar com ferramentas, cai numa
        // chamada normal — o chat NUNCA quebra por causa do tool-calling.
        let response;
        try {
          response = await invokeLLM({
            messages: llmMessages,
            tools: AGENT_TOOLS,
            toolChoice: "auto",
          });
        } catch (toolErr) {
          console.warn("[chat] tool-calling falhou, caindo pra chamada simples:", toolErr);
          response = await invokeLLM({ messages: llmMessages });
        }
        const choice = response.choices[0]?.message;
        const toolCalls: any[] = Array.isArray((choice as any)?.tool_calls)
          ? (choice as any).tool_calls
          : [];

        let assistantMessage = textOf(choice?.content);
        const actions: string[] = [];

        if (toolCalls.length > 0) {
          // EXECUTA cada ferramenta pedida. O modelo pode pedir várias de
          // uma vez (ex: criar tarefa + gerar flashcards).
          for (const tc of toolCalls) {
            let parsedArgs: any = {};
            try {
              parsedArgs = JSON.parse(tc?.function?.arguments || "{}");
            } catch {
              parsedArgs = {};
            }
            const result = await executeAgentTool(tc?.function?.name, parsedArgs, ctx.user.id);
            actions.push((result.ok ? "✅ " : "⚠️ ") + result.summary);
          }

          // Segunda chamada, SEM ferramentas: pede o RELATÓRIO final ao
          // usuário com base no que foi executado. (Não reenviamos as
          // tool_calls porque o SDK _core não as preserva; folhamos o
          // resultado como contexto.)
          const reportPrompt =
            `Você acabou de executar as ações abaixo no app do usuário. ` +
            `Escreva agora a resposta final, em Português (BR), relatando de forma organizada ` +
            `o que foi feito (use ✅ e listas), e sugira o próximo passo. ` +
            `NÃO invente ações que não estão nesta lista.\n\nAções executadas:\n` +
            actions.map((a) => `- ${a}`).join("\n");
          // Robustez: se a chamada do relatório falhar, ainda assim
          // respondemos com o resumo das ações (nunca engole o que foi feito).
          let reportText = "";
          try {
            const reportResp = await invokeLLM({
              messages: [...llmMessages, { role: "user" as const, content: reportPrompt }],
            });
            reportText = textOf(reportResp.choices[0]?.message?.content).trim();
          } catch (reportErr) {
            console.warn("[chat] chamada de relatório falhou, usando resumo das ações:", reportErr);
          }
          assistantMessage =
            reportText ||
            `Prontinho! Aqui está o que fiz:\n\n${actions.join("\n")}`;
        }

        // Fallback amigável se o LLM retornar vazio. Preserva o histórico
        // da conversa (evita mensagem "user" órfã sem resposta) e sinaliza
        // ao usuário o que aconteceu.
        const finalAssistantMessage =
          assistantMessage.trim() ||
          "Desculpe, não consegui gerar resposta agora. Pode reformular sua pergunta?";

        messages.push({ role: "assistant", content: finalAssistantMessage, timestamp: new Date() });

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
          message: finalAssistantMessage,
          // Ações que o agente executou (criar tarefa, gerar material...).
          // O frontend usa pra atualizar as outras telas (invalidar queries).
          actions,
        };
      }),

    // Completa uma tarefa imitando o estilo do usuário. Cria uma NOVA
    // conversa dedicada, chama o LLM com memórias como contexto, e
    // salva o resultado no campo completedContent da tarefa (que já
    // existe no schema).
    completeTask: protectedProcedure
      .input(z.object({ taskId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const task = await db.getTaskById(input.taskId, ctx.user.id);
        if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Tarefa não encontrada" });

        // Delega pra generateCompletion (autoComplete.ts) — mesma lógica
        // usada pelo pipeline autônomo do Toddle. Elimina duplicação de
        // ~50 linhas de prompt.
        const result = await generateCompletion(ctx.user.id, task as any);

        if (!result.trim()) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "A IA retornou resposta vazia. Tente novamente ou reformule a tarefa.",
          });
        }

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
      .input(z.object({ deckId: z.number().int().positive().optional() }))
      .query(async ({ ctx, input }) => {
        if (input.deckId) {
          return await db.getFlashcardsByDeckId(input.deckId, ctx.user.id);
        }
        return await db.getFlashcardsByUserId(ctx.user.id);
      }),
    create: protectedProcedure
      .input(z.object({
        deckId: z.number().int().positive().optional(),
        question: z.string().min(1, "Pergunta é obrigatória").max(2000),
        answer: z.string().min(1, "Resposta é obrigatória").max(5000),
        subject: z.string().max(255).optional(),
        difficulty: z.enum(["fácil", "médio", "difícil"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.createFlashcard({
          userId: ctx.user.id,
          ...input,
        });
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteFlashcard(input.id, ctx.user.id);
        return { success: true };
      }),
    // Registra que o usuário revisou o flashcard. Incrementa timesReviewed
    // e atualiza lastReviewedAt. Endpoint fire-and-forget do StudyDeck.
    review: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await db.reviewFlashcard(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  decks: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getFlashcardDecksByUserId(ctx.user.id);
    }),
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1, "Nome é obrigatório").max(255),
        description: z.string().max(2000).optional(),
        subject: z.string().max(255).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.createFlashcardDeck({
          userId: ctx.user.id,
          ...input,
        });
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteFlashcardDeck(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  quizzes: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getQuizzesByUserId(ctx.user.id);
    }),
    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteQuiz(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  studyGuides: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getStudyGuidesByUserId(ctx.user.id);
    }),
    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteStudyGuide(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  studyTools: router({
    generateFlashcards: protectedProcedure
      .input(z.object({
        content: z.string().min(10, "Adicione mais conteúdo (mínimo 10 caracteres)").max(50000),
        subject: z.string().max(255).optional(),
        deckId: z.number().int().positive().optional(),
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

        // Filtra: só aceita cards com question E answer não vazios.
        // Impede que LLM retornando {question: null} ou {answer: ""}
        // suje o banco com flashcards inúteis.
        const validCards = flashcards.filter(
          (c) => typeof c?.question === "string" && c.question.trim() && typeof c?.answer === "string" && c.answer.trim()
        );

        if (validCards.length === 0) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "A IA não conseguiu gerar flashcards dessa vez. Tente novamente ou forneça mais contexto.",
          });
        }

        const created = [];
        for (const card of validCards) {
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
        content: z.string().min(10, "Adicione mais conteúdo (mínimo 10 caracteres)").max(50000),
        subject: z.string().max(255).optional(),
        questionCount: z.number().int().min(1).max(20).default(5),
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
        const rawQuestions = Array.isArray(parsed?.questions) ? parsed.questions : [];

        // Filtra: cada questão precisa de question (string), options (array
        // com pelo menos 2) e correctAnswer (string). Sem isso o QuizGame
        // não consegue funcionar.
        const validQuestions = rawQuestions.filter(
          (q) =>
            typeof q?.question === "string" &&
            q.question.trim() &&
            Array.isArray(q?.options) &&
            q.options.length >= 2 &&
            typeof q?.correctAnswer === "string" &&
            q.correctAnswer.trim()
        );

        if (validQuestions.length === 0) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "A IA não conseguiu gerar o quiz dessa vez. Tente novamente com mais conteúdo.",
          });
        }

        const quizData = { questions: validQuestions };

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
        content: z.string().min(10, "Adicione mais conteúdo (mínimo 10 caracteres)").max(50000),
        subject: z.string().max(255).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content:
                `Você é um gerador de guias de estudo em Português (BR). ` +
                `Produza um guia bem estruturado em Markdown com títulos (##), subtópicos (###), ` +
                `listas com marcadores, e seções de "Conceitos-chave", "Exemplos" e "Como estudar". ` +
                `Não retorne JSON, não use code fence — apenas o Markdown direto do guia.`,
            },
            {
              role: "user",
              content: `Crie um guia de estudo sobre: ${input.content}`,
            },
          ],
        });

        const raw = response.choices[0]?.message?.content;
        const guideStr =
          typeof raw === "string"
            ? raw
            : Array.isArray(raw)
              ? raw.map((p: any) => (typeof p === "string" ? p : p?.text ?? "")).join("")
              : "";

        if (!guideStr.trim()) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "A IA não conseguiu gerar o guia dessa vez. Tente novamente com mais conteúdo.",
          });
        }

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
      // Considera pendente: sem completedAt E status != "concluída".
      // Dados antigos (antes do fix "server toca completedAt") podem ter
      // status concluída mas completedAt null. Checar ambos evita
      // reincluir na proxima geração.
      const pendingTasks = tasks.filter(
        (t) => !t.completedAt && t.status !== "concluída"
      );
      if (pendingTasks.length === 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Crie tarefas pendentes primeiro para gerar um cronograma.",
        });
      }

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
            // Cap em 50 tarefas pra não estourar context em usuário com
            // muita coisa acumulada. Prioriza as mais urgentes (menor
            // dueDate primeiro; nulls no fim).
            content: `Crie um cronograma para estas tarefas: ${JSON.stringify(
              pendingTasks
                .slice()
                .sort((a, b) => {
                  const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
                  const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
                  return ad - bd;
                })
                .slice(0, 50)
                .map((t) => ({
                  title: t.title,
                  dueDate: t.dueDate,
                  priority: t.priority,
                  subject: t.subject,
                }))
            )}`,
          },
        ],
      });

      const parsed = extractJson<{ schedule?: any[] }>(response.choices[0]?.message?.content);
      const scheduleData = {
        schedule: Array.isArray(parsed?.schedule) ? parsed.schedule : [],
      };
      if (scheduleData.schedule.length === 0) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "A IA não conseguiu gerar um cronograma dessa vez. Tente novamente.",
        });
      }

      return await db.createStudySchedule({
        userId: ctx.user.id,
        schedule: scheduleData.schedule,
      });
    }),

    get: protectedProcedure.query(async ({ ctx }) => {
      return await db.getLatestStudySchedule(ctx.user.id);
    }),

    // Marca/desmarca um dia do cronograma como concluído. Persiste o flag
    // `done` dentro do JSON do dia, sem regenerar o cronograma inteiro.
    setDayDone: protectedProcedure
      .input(z.object({ index: z.number().int().min(0), done: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const latest = await db.getLatestStudySchedule(ctx.user.id);
        if (!latest || !Array.isArray(latest.schedule)) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Nenhum cronograma para atualizar.",
          });
        }
        const days = (latest.schedule as any[]).slice();
        if (input.index >= days.length) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Dia inválido." });
        }
        days[input.index] = { ...days[input.index], done: input.done };
        return await db.updateLatestStudySchedule(ctx.user.id, days);
      }),

    // Move um dia pra cima/baixo na ordem do cronograma. Botões ↑/↓ em vez
    // de drag&drop porque o app é mobile-first (drag é ruim em touch).
    reorderDay: protectedProcedure
      .input(z.object({ index: z.number().int().min(0), direction: z.enum(["up", "down"]) }))
      .mutation(async ({ ctx, input }) => {
        const latest = await db.getLatestStudySchedule(ctx.user.id);
        if (!latest || !Array.isArray(latest.schedule)) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Nenhum cronograma para reordenar.",
          });
        }
        const days = (latest.schedule as any[]).slice();
        const target = input.direction === "up" ? input.index - 1 : input.index + 1;
        // Nas bordas é no-op (não erra, só não move).
        if (input.index >= days.length || target < 0 || target >= days.length) {
          return latest;
        }
        [days[input.index], days[target]] = [days[target], days[input.index]];
        return await db.updateLatestStudySchedule(ctx.user.id, days);
      }),
  }),

  upload: router({
    file: protectedProcedure
      .input(z.object({
        fileName: z.string().min(1).max(255),
        fileData: z.string().min(1),
        mimeType: z.string().max(255),
      }))
      .mutation(async ({ ctx, input }) => {
        const buffer = Buffer.from(input.fileData, "base64");
        // Limite server-side (10MB). Frontend ja checa em Chat.tsx, mas
        // outros clientes (mobile, terceiros usando tRPC direto) podem
        // ignorar e mandar arquivo enorme — memoria, custo de S3, etc.
        const MAX_BYTES = 10 * 1024 * 1024;
        if (buffer.length > MAX_BYTES) {
          throw new TRPCError({
            code: "PAYLOAD_TOO_LARGE",
            message: `Arquivo excede o limite de ${MAX_BYTES / 1024 / 1024}MB.`,
          });
        }
        // Sanitiza fileName: remove path traversal ('/', '\\', '..') e
        // caracteres perigosos. Mantem espacos e acentos (S3 aceita).
        const safeName = input.fileName
          .replace(/[\/\\]/g, "_")
          .replace(/\.\.+/g, "_")
          .replace(/[<>:"|?*\x00-\x1f]/g, "_")
          .slice(0, 200);
        const fileKey = `${ctx.user.id}-files/${Date.now()}-${safeName}`;

        const { key, url } = await storagePut(fileKey, buffer, input.mimeType);

        return { key, url, fileName: safeName };
      }),
  }),

  memories: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserMemoriesByUserId(ctx.user.id);
    }),
    create: protectedProcedure
      .input(z.object({
        title: z.string().min(1, "Título é obrigatório").max(255),
        category: z.string().max(255).optional(),
        content: z.string().min(1, "Conteúdo é obrigatório").max(200000),
        source: z.string().max(100).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.createUserMemory({
          userId: ctx.user.id,
          ...input,
        });
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        title: z.string().min(1).max(255).optional(),
        category: z.string().max(255).optional(),
        content: z.string().min(1).max(200000).optional(),
        source: z.string().max(100).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...updates } = input;
        await db.updateUserMemory(id, ctx.user.id, updates);
        return await db.getUserMemoryById(id, ctx.user.id);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
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
        taskId: z.number().int().positive(),
        reminderTime: z.date(),
      }))
      .mutation(async ({ ctx, input }) => {
        const task = await db.getTaskById(input.taskId, ctx.user.id);
        if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Tarefa não encontrada" });

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
        emailSenderEmail: z.union([z.literal(""), z.string().email({ message: "Formato de email inválido" })]).optional(),
        emailSenderName: z.string().max(255).optional(),
        whatsappPhoneNumber: z.string().max(20).optional(),
        toddleEmail: z.string().max(320).optional(),
        toddlePassword: z.string().max(500).optional(),
        toddleProvider: z.string().max(100).optional(),
        // Reusa a coluna toddleApiKey (já existe na tabela) para guardar o
        // LINK do calendário .ics do Toddle. Com ele, a sync roda sozinha.
        toddleApiKey: z.union([z.literal(""), z.string().max(2048)]).optional(),
        // Automação total: quando true, cada tarefa nova sincronizada é
        // completada pela IA no estilo do usuário e enviada por e-mail.
        toddleEnabled: z.boolean().optional(),
        gmailUser: z.union([z.literal(""), z.string().email({ message: "Formato de email inválido" })]).optional(),
        gmailAppPassword: z.string().max(500).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.createOrUpdateIntegrationSettings(ctx.user.id, input);
      }),
  }),

  toddle: router({
    // Sincroniza AGORA a partir do link de calendário (.ics) salvo. Mesma
    // lógica que o cron roda sozinho — aqui é o disparo manual do botão.
    sync: protectedProcedure.mutation(async ({ ctx }) => {
      const settings = await db.getIntegrationSettings(ctx.user.id);
      const feedUrl = (settings?.toddleApiKey || "").trim();
      if (!feedUrl) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Cole o link do calendário (.ics) do Toddle em Configurações → Toddle para sincronizar automaticamente.",
        });
      }
      try {
        return await syncToddleForUser(ctx.user.id);
      } catch (err: any) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: String(err?.message ?? "Falha ao sincronizar com o calendário."),
        });
      }
    }),

    // Importa tarefas a partir de um arquivo .ics (iCalendar) exportado do
    // Toddle / Google / Outlook. Sem API externa: o usuário envia o texto
    // do arquivo e a gente parseia local. Deduplica contra tarefas
    // existentes por (título + dia do prazo).
    importIcs: protectedProcedure
      .input(z.object({ content: z.string().min(1).max(2_000_000, "Arquivo muito grande") }))
      .mutation(async ({ ctx, input }) => {
        const events = parseIcs(input.content);
        if (events.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Nenhum evento encontrado no arquivo. Confira se é uma exportação de calendário (.ics) válida.",
          });
        }
        const existing = await db.getTasksByUserId(ctx.user.id);
        const keyOf = (title: string, due: Date | null) =>
          `${title.trim().toLowerCase()}|${due ? new Date(due).toISOString().slice(0, 10) : ""}`;
        const seen = new Set(
          existing.map((t) => keyOf(t.title, t.dueDate ? new Date(t.dueDate) : null))
        );
        let imported = 0;
        let skipped = 0;
        for (const ev of events) {
          const key = keyOf(ev.title, ev.dueDate);
          if (seen.has(key)) {
            skipped++;
            continue;
          }
          seen.add(key);
          const created = await db.createTask({
            userId: ctx.user.id,
            title: ev.title.slice(0, 255),
            description: ev.description ? ev.description.slice(0, 5000) : undefined,
            dueDate: ev.dueDate ?? undefined,
          });
          if (created) await syncTaskReminder(ctx.user.id, created as any);
          imported++;
        }
        return { imported, skipped, total: events.length };
      }),
  }),

  whatsapp: router({
    // Envio real ainda não implementado. Endpoint existe pra que a UI
    // consiga oferecer botão "Testar WhatsApp" com feedback claro.
    // Substitua pelo provider Twilio/similar quando a integração chegar.
    sendTest: protectedProcedure.mutation(async ({ ctx }) => {
      const settings = await db.getIntegrationSettings(ctx.user.id);
      const phone = settings?.whatsappPhoneNumber?.trim();
      // Precisa de pelo menos 8 digitos (mais curto que qualquer numero
      // real internacional). Aceita "+", espacos e dashes na entrada.
      const digits = phone?.replace(/\D/g, "") ?? "";
      if (!phone || digits.length < 8) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Configure um número de WhatsApp válido em Configurações antes de testar.",
        });
      }
      // TODO(whatsapp): integrar com provedor (Twilio, Meta WhatsApp API,
      // ou serviço próprio). Por enquanto, informa que está a caminho.
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message:
          "Envio via WhatsApp ainda não está disponível. Suas credenciais foram salvas e você receberá lembretes assim que a integração for ativada.",
      });
    }),
  }),

  email: router({
    sendTest: protectedProcedure
      .input(z.object({
        toEmail: z.string().email({ message: "Formato de email inválido" }),
      }))
      .mutation(async ({ ctx, input }) => {
        const settings = await db.getIntegrationSettings(ctx.user.id);
        if (!settings?.gmailUser || !settings?.gmailAppPassword) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Configure seu Gmail (email + senha de app) em Configurações antes de enviar o teste.",
          });
        }
        try {
          return await sendTestEmail(
            input.toEmail,
            settings.gmailUser,
            settings.gmailAppPassword,
            settings.emailSenderName || ctx.user.name
          );
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: friendlyEmailError(error),
          });
        }
      }),

    // Envia o conteúdo gerado pela IA (completedContent da tarefa) para
    // o email do usuário. Usado depois do "Completar com IA" pra ele
    // receber o texto no email e imprimir/entregar.
    sendCompletedTask: protectedProcedure
      .input(z.object({ taskId: z.number().int().positive() }))
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

        try {
          return await sendCompletedTaskEmail(
            settings.emailSenderEmail,
            task.title,
            task.completedContent,
            settings.gmailUser,
            settings.gmailAppPassword,
            settings.emailSenderName || ctx.user.name
          );
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: friendlyEmailError(error),
          });
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
