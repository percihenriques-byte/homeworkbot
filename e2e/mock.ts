import type { Page } from "@playwright/test";

// Mock de backend tRPC para testes E2E. Intercepta /api/trpc/**, entende o
// batch + superjson, e responde a partir de um estado em memória (mutável),
// pra fluxos como "criar tarefa → ela aparece na lista" funcionarem de verdade
// no navegador — sem banco, LLM ou OAuth reais.

export type MockState = {
  user: any;
  tasks: any[];
  conversations: any[];
  integrationSettings: any;
  memories: any[];
  flashcards: any[];
  quizzes: any[];
  studyGuides: any[];
  schedule: any;
};

const DEFAULT_USER = { id: 1, name: "Aluno Teste", email: "aluno@teste.com", role: "user" };

export async function installTrpcMock(page: Page, overrides: Partial<MockState> = {}) {
  const state: MockState = {
    user: null,
    tasks: [],
    conversations: [],
    integrationSettings: null,
    memories: [],
    flashcards: [],
    quizzes: [],
    studyGuides: [],
    schedule: null,
    ...overrides,
  };
  let nextId = 1000;

  await page.route("**/api/trpc/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^.*\/api\/trpc\//, "");
    const procs = path.split(",").map(decodeURIComponent);

    let inputs: Record<string, any> = {};
    if (req.method() === "GET") {
      const raw = url.searchParams.get("input");
      if (raw) {
        try {
          inputs = JSON.parse(raw);
        } catch {
          /* ignora */
        }
      }
    } else {
      try {
        inputs = JSON.parse(req.postData() || "{}");
      } catch {
        /* ignora */
      }
    }

    const results = procs.map((proc, i) => {
      const input = inputs[String(i)]?.json;
      return { result: { data: { json: resolve(proc, input, state, () => nextId++) } } };
    });

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(results),
    });
  });

  return state;
}

export const authedUser = DEFAULT_USER;

function resolve(proc: string, input: any, s: MockState, nextId: () => number): any {
  switch (proc) {
    case "auth.me":
      return s.user;
    case "auth.logout":
      s.user = null;
      return { success: true };
    case "tasks.list":
    case "tasks.upcoming":
      return s.tasks;
    case "conversations.list":
      return s.conversations;
    case "integrationSettings.get":
      return s.integrationSettings;
    case "userPreferences.get":
      return null;
    case "memories.list":
      return s.memories;
    case "flashcards.list":
      return s.flashcards;
    case "quizzes.list":
      return s.quizzes;
    case "studyGuides.list":
      return s.studyGuides;
    case "schedule.get":
      return s.schedule;
    case "schedule.generate": {
      s.schedule = {
        id: 1,
        schedule: [
          { date: "2026-07-15", subject: "Matemática", tasks: ["Estudar frações"], duration: "1h", done: false },
          { date: "2026-07-16", subject: "Português", tasks: ["Ler capítulo 3"], duration: "1h30", done: false },
        ],
      };
      return s.schedule;
    }
    case "schedule.setDayDone": {
      if (s.schedule?.schedule?.[input?.index]) s.schedule.schedule[input.index].done = input?.done;
      return s.schedule;
    }
    case "schedule.reorderDay": {
      const arr = s.schedule?.schedule;
      if (arr) {
        const t = input?.direction === "up" ? input.index - 1 : input.index + 1;
        if (t >= 0 && t < arr.length) [arr[input.index], arr[t]] = [arr[t], arr[input.index]];
      }
      return s.schedule;
    }
    case "reminders.list":
      return [];

    case "studyTools.generateFlashcards": {
      const cards = [
        { id: nextId(), userId: 1, question: "Quanto é 2+2?", answer: "4", subject: input?.subject, difficulty: "fácil", timesReviewed: 0 },
        { id: nextId(), userId: 1, question: "Capital do Brasil?", answer: "Brasília", subject: input?.subject, difficulty: "fácil", timesReviewed: 0 },
      ];
      s.flashcards.push(...cards);
      return { created: cards.length, flashcards: cards };
    }
    case "studyTools.generateQuiz": {
      const q = { id: nextId(), userId: 1, title: `Quiz: ${input?.subject ?? "Geral"}`, subject: input?.subject, questions: [{ question: "2+2?", options: ["3", "4"], correctAnswer: "4" }], totalQuestions: 1 };
      s.quizzes.push(q);
      return q;
    }
    case "studyTools.generateStudyGuide": {
      const g = { id: nextId(), userId: 1, title: `Guia: ${input?.subject ?? "Geral"}`, subject: input?.subject, content: "## Guia\nConteúdo de estudo." };
      s.studyGuides.push(g);
      return g;
    }
    case "flashcards.review":
      return { success: true };
    case "flashcards.delete": {
      s.flashcards = s.flashcards.filter((x) => x.id !== input?.id);
      return { success: true };
    }
    case "quizzes.delete": {
      s.quizzes = s.quizzes.filter((x) => x.id !== input?.id);
      return { success: true };
    }
    case "studyGuides.delete": {
      s.studyGuides = s.studyGuides.filter((x) => x.id !== input?.id);
      return { success: true };
    }

    case "integrationSettings.update": {
      s.integrationSettings = { ...(s.integrationSettings ?? {}), ...input };
      return s.integrationSettings;
    }
    case "userPreferences.update":
      return { ...input };
    case "email.sendTest":
      return { success: true };

    case "conversations.create": {
      const c = { id: nextId(), userId: 1, title: input?.title ?? "Nova Conversa", messages: [], taskId: input?.taskId ?? null, createdAt: new Date().toISOString() };
      s.conversations.push(c);
      return c;
    }
    case "conversations.rename": {
      const c = s.conversations.find((x) => x.id === input?.id);
      if (c) c.title = input?.title;
      return c ?? null;
    }
    case "conversations.delete": {
      s.conversations = s.conversations.filter((x) => x.id !== input?.id);
      return { success: true };
    }
    case "chat.message": {
      const c = s.conversations.find((x) => x.id === input?.conversationId);
      const reply = "Claro! Aqui está a resposta do Jarvis (mock).";
      if (c) {
        c.messages = Array.isArray(c.messages) ? c.messages : [];
        c.messages.push({ role: "user", content: input?.message ?? "" });
        c.messages.push({ role: "assistant", content: reply });
      }
      return { conversationId: input?.conversationId, message: reply, actions: [] };
    }

    case "tasks.create": {
      const t = {
        id: nextId(),
        userId: 1,
        status: "pendente",
        completedAt: null,
        completedContent: null,
        priority: input?.priority ?? "média",
        difficulty: input?.difficulty ?? "médio",
        type: input?.type ?? "tarefa",
        createdAt: new Date().toISOString(),
        ...input,
      };
      s.tasks.push(t);
      return t;
    }
    case "tasks.update": {
      const t = s.tasks.find((x) => x.id === input?.id);
      if (t) Object.assign(t, input);
      return t ?? null;
    }
    case "tasks.delete": {
      s.tasks = s.tasks.filter((x) => x.id !== input?.id);
      return { success: true };
    }
    case "memories.create": {
      const m = { id: nextId(), userId: 1, createdAt: new Date().toISOString(), ...input };
      s.memories.push(m);
      return m;
    }
    case "memories.update": {
      const m = s.memories.find((x) => x.id === input?.id);
      if (m) Object.assign(m, input);
      return m ?? null;
    }
    case "memories.delete": {
      s.memories = s.memories.filter((x) => x.id !== input?.id);
      return { success: true };
    }

    default:
      return null;
  }
}
