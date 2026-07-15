// Seleciona as próximas N tarefas com prazo dentro dos próximos D dias.
// Mostrado no card "Próximos Prazos" do Painel — extraído pra util pura
// pra ter cobertura de testes (bordas de dias, fuso, dedup de urgência).

import { normalize } from "./normalize";

export type UpcomingInput = {
  status?: string | null;
  dueDate?: Date | string | null;
};

export type UpcomingOptions = {
  /** Dia em que estamos. Injetável pra teste. */
  now?: Date;
  /** Janela em dias a partir de `now`. Default: 7. */
  daysAhead?: number;
  /** Nº máximo devolvido. Default: 5. */
  limit?: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Filtra tarefas pendentes com prazo entre `now` e `now + daysAhead * 24h`,
 * ordena por prazo crescente, corta em `limit`. Devolve um array novo (não
 * muta o de entrada — protege react-query cache).
 *
 * Tarefas concluídas (`status` normalizado = "concluida") são excluídas.
 * Tarefas sem `dueDate` também.
 */
export function getUpcomingTasks<T extends UpcomingInput>(
  tasks: readonly T[],
  opts: UpcomingOptions = {}
): T[] {
  const now = (opts.now ?? new Date()).getTime();
  const daysAhead = opts.daysAhead ?? 7;
  const limit = opts.limit ?? 5;
  const cutoff = now + daysAhead * DAY_MS;

  return tasks
    .filter((t) => {
      if (normalize(t.status) === "concluida") return false;
      if (!t.dueDate) return false;
      const ms = new Date(t.dueDate).getTime();
      if (!Number.isFinite(ms)) return false;
      return ms >= now && ms < cutoff;
    })
    .slice() // clone antes de sort — não muta original
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
    .slice(0, limit);
}
