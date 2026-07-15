// Filtra saídas do LLM (flashcards, quizzes) mantendo só as entradas com
// os campos mínimos preenchidos. Antes vivia inline em 2 lugares —
// agentTools + routers.studyTools. Se um provedor devolver algo malformado
// (question null, options undefined, etc), estas funções removem o item
// em vez de deixar sujar o banco.

export type FlashcardCandidate = {
  question?: unknown;
  answer?: unknown;
  difficulty?: unknown;
};

export type ValidFlashcard = {
  question: string;
  answer: string;
  difficulty?: string;
};

export function validateFlashcards(
  raw: unknown
): ValidFlashcard[] {
  if (!Array.isArray(raw)) return [];
  const out: ValidFlashcard[] = [];
  for (const c of raw as FlashcardCandidate[]) {
    if (
      typeof c?.question === "string" &&
      c.question.trim() &&
      typeof c?.answer === "string" &&
      c.answer.trim()
    ) {
      const card: ValidFlashcard = {
        question: c.question,
        answer: c.answer,
      };
      if (typeof c.difficulty === "string" && c.difficulty.trim()) {
        card.difficulty = c.difficulty;
      }
      out.push(card);
    }
  }
  return out;
}

export type QuizQuestionCandidate = {
  question?: unknown;
  options?: unknown;
  correctAnswer?: unknown;
};

export type ValidQuizQuestion = {
  question: string;
  options: string[];
  correctAnswer: string;
};

export function validateQuizQuestions(
  raw: unknown
): ValidQuizQuestion[] {
  if (!Array.isArray(raw)) return [];
  const out: ValidQuizQuestion[] = [];
  for (const q of raw as QuizQuestionCandidate[]) {
    if (
      typeof q?.question === "string" &&
      q.question.trim() &&
      Array.isArray(q?.options) &&
      q.options.length >= 2 &&
      typeof q?.correctAnswer === "string" &&
      q.correctAnswer.trim()
    ) {
      out.push({
        question: q.question,
        options: (q.options as unknown[]).map((o) => String(o)),
        correctAnswer: q.correctAnswer,
      });
    }
  }
  return out;
}
