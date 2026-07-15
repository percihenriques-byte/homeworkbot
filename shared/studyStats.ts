// Estatísticas de estudo mostradas no card do Painel: contagens totais e
// nº de dias ativos nos últimos 7. Extraído do Dashboard pra ficar puro
// e testável — mesma lógica que o card renderiza, com `now` injetável.

export type StudyStatsInput = {
  tasks?: ReadonlyArray<{ completedAt?: Date | string | null | undefined }>;
  flashcards?: ReadonlyArray<{
    timesReviewed?: number | string | null;
    lastReviewedAt?: Date | string | null;
  }>;
  conversations?: ReadonlyArray<{ updatedAt?: Date | string | null | undefined }>;
  memories?: ReadonlyArray<{ createdAt?: Date | string | null | undefined }>;
};

export type StudyStats = {
  /** Total de flashcards do usuário. */
  flashcards: number;
  /** Soma de `timesReviewed` de todos os flashcards (revisões acumuladas). */
  reviews: number;
  /** Total de conversas com a IA. */
  conversations: number;
  /** Total de memórias (referências) salvas. */
  memories: number;
  /** Nº de dias distintos com QUALQUER atividade nos últimos 7 dias. */
  activeDays: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

// Chave local de dia (não UTC). Ver [[compute-streak]] — usar toISOString()
// derrubaria dias no fuso do Brasil.
function toLocalDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function computeStudyStats(
  input: StudyStatsInput = {},
  now: Date = new Date()
): StudyStats {
  const cards = input.flashcards ?? [];
  const reviews = cards.reduce((sum, c) => {
    const n = Number(c?.timesReviewed);
    return Number.isFinite(n) ? sum + n : sum;
  }, 0);

  const nowMs = now.getTime();
  const weekAgo = nowMs - 7 * DAY_MS;
  const activeDays = new Set<string>();
  const mark = (ts: Date | string | null | undefined) => {
    if (ts == null) return;
    const d = new Date(ts);
    const t = d.getTime();
    if (!Number.isFinite(t)) return;
    if (t < weekAgo || t > nowMs) return;
    activeDays.add(toLocalDayKey(d));
  };

  for (const t of input.tasks ?? []) mark(t?.completedAt);
  for (const c of cards) mark(c?.lastReviewedAt);
  for (const c of input.conversations ?? []) mark(c?.updatedAt);
  for (const m of input.memories ?? []) mark(m?.createdAt);

  return {
    flashcards: cards.length,
    reviews,
    conversations: (input.conversations ?? []).length,
    memories: (input.memories ?? []).length,
    activeDays: activeDays.size,
  };
}
