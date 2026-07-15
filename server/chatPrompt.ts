// Constrói o system prompt do Jarvis para chat.message. Extraído de
// server/routers.ts pra ficar testável — a função é pura (data-in →
// string-out), então dá pra fixar `now` e verificar seções condicionais.

export type ChatPromptTask = {
  title: string;
  subject?: string | null;
  type?: string | null;
  dueDate?: Date | string | null;
  description?: string | null;
  notes?: string | null;
} | null | undefined;

export type ChatPromptMemory = {
  title: string;
  category?: string | null;
  content: string;
};

export type ChatPromptOpts = {
  now?: Date;
  aiStyle?: string | null;
  task?: ChatPromptTask;
  memories?: readonly ChatPromptMemory[];
};

// Limite pra conteúdo de cada memória no prompt. 300 chars = umas 60
// palavras: dá pra pegar tom/estilo sem estourar o context window quando
// o usuário tem muitas memórias longas.
const MEMORY_SNIPPET_MAX = 300;

// Nº máximo de memórias injetadas. Além disso vira ruído + estoura tokens.
export const MEMORY_LIMIT = 5;

const BASE_PROMPT =
  `Você é o Jarvis de Estudos — um assistente escolar AGÊNTICO em Português (BR), no estilo do Manus. ` +
  `Você não é um bot de perguntas e respostas: você PLANEJA, EXECUTA e RELATA.\n\n` +
  `COMO AGIR:\n` +
  `1. PLANO — para qualquer pedido que envolva mais de um passo (ex: "cria a tarefa da prova e gera flashcards"), ` +
  `primeiro mostre um plano curto numerado do que vai fazer.\n` +
  `2. EXECUÇÃO — use as ferramentas disponíveis para REALMENTE fazer as coisas (criar tarefas, gerar flashcards, ` +
  `quizzes, guias de estudo e cronogramas). Não diga "você pode criar" — crie você mesmo pela ferramenta. ` +
  `Execute os passos na ordem e narre o progresso ("✅ Tarefa criada", "✅ 8 flashcards gerados").\n` +
  `3. RELATÓRIO — ao final, resuma o que foi feito e sugira o próximo passo útil.\n\n` +
  `ESTILO: respostas ricas e organizadas — listas numeradas, marcadores, emojis de sinalização (✅ 📌 📝 🎯), ` +
  `títulos curtos em negrito quando ajudar. Seja acolhedor e claro (o usuário é um estudante). ` +
  `Sempre em Português (BR). Se o pedido for só uma dúvida conceitual, responda direto e bem, sem inventar plano.`;

function truncateMemory(raw: string): string {
  const s = String(raw ?? "");
  if (s.length <= MEMORY_SNIPPET_MAX) return s;
  return s.substring(0, MEMORY_SNIPPET_MAX) + "...";
}

export function buildChatSystemPrompt(opts: ChatPromptOpts = {}): string {
  const now = opts.now ?? new Date();
  let prompt = BASE_PROMPT;

  const hojeStr = now.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
  prompt += `\n\nData de hoje: ${hojeStr} (ISO: ${now.toISOString().slice(0, 10)}). ` +
    `Use isso para converter prazos relativos (ex: "sexta", "amanhã") em datas absolutas (AAAA-MM-DD).`;

  if (opts.aiStyle && opts.aiStyle.trim()) {
    prompt += `\n\nEstilo preferido do usuário: ${opts.aiStyle.trim()}`;
  }

  const task = opts.task;
  if (task) {
    prompt += `\n\nEsta conversa está associada à tarefa do usuário:\n`;
    prompt += `- Título: ${task.title}\n`;
    if (task.subject) prompt += `- Disciplina: ${task.subject}\n`;
    if (task.type) prompt += `- Tipo: ${task.type}\n`;
    if (task.dueDate) {
      prompt += `- Prazo: ${new Date(task.dueDate).toLocaleDateString("pt-BR")}\n`;
    }
    if (task.description) prompt += `- Descrição: ${task.description}\n`;
    if (task.notes) prompt += `- Anotações do usuário: ${task.notes}\n`;
    prompt += `\nUse esse contexto para ajudar a resolver ou completar essa tarefa específica.`;
  }

  const memories = opts.memories ?? [];
  if (memories.length > 0) {
    prompt += `\n\nMemórias e referências do usuário para personalização:\n`;
    for (const m of memories.slice(0, MEMORY_LIMIT)) {
      const cat = m.category ? ` (${m.category})` : "";
      prompt += `\n- ${m.title}${cat}: ${truncateMemory(m.content)}`;
    }
    prompt += `\n\nUse essas memórias para adaptar seu tom, estilo, abordagem e forma de responder.`;
  }

  return prompt;
}
