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
    case "reminders.list":
      return [];

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
    case "memories.delete": {
      s.memories = s.memories.filter((x) => x.id !== input?.id);
      return { success: true };
    }

    default:
      return null;
  }
}
