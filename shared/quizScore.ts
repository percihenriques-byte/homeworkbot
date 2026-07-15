// Score do quiz mostrado no fim da rodada em StudyTools.
// Extraído do QuizGame pra ficar puro e testável — bordas de %, badge
// por faixa, questões puladas contam como erro.

export type QuizQuestion = {
  correctAnswer: string;
};

export type QuizScore = {
  /** Total de questões. */
  total: number;
  /** Acertos. Questões puladas (não respondidas) NÃO contam. */
  score: number;
  /** Percentual (0-100), inteiro. 0 se total = 0. */
  pct: number;
  /**
   * Emoji feedback:
   *   >= 80% → "🏆"
   *   >= 60% → "👍"
   *   < 60%  → "📚"
   * (Zero questões → "📚" por default seguro.)
   */
  badge: "🏆" | "👍" | "📚";
};

export function computeQuizScore(
  questions: readonly QuizQuestion[],
  answers: Readonly<Record<number, string | null | undefined>>
): QuizScore {
  const total = questions.length;
  let score = 0;
  for (let i = 0; i < total; i++) {
    const given = answers[i];
    if (given && given === questions[i]?.correctAnswer) {
      score++;
    }
  }
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const badge: QuizScore["badge"] = pct >= 80 ? "🏆" : pct >= 60 ? "👍" : "📚";
  return { total, score, pct, badge };
}
