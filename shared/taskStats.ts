// Agregação de estatísticas de tarefas usada no Dashboard.
// Extraída pra util testável — usa taskUrgency internamente pra ficar
// consistente com Tarefas/lembretes.

import { taskUrgency, type UrgencyInput } from "./taskUrgency";

export type TaskStats = {
  total: number;
  done: number;
  pending: number;
  overdue: number;
  dueSoon: number;
  /** Percentual concluído (0-100), inteiro. 0 se não há tarefas. */
  pct: number;
};

/**
 * Conta tarefas por categoria de urgência e devolve stats agregados
 * usados no Painel. `now` é injetado pra facilitar testes.
 */
export function computeTaskStats(
  tasks: readonly UrgencyInput[],
  now: Date = new Date()
): TaskStats {
  let done = 0;
  let overdue = 0;
  let dueSoon = 0;
  for (const t of tasks) {
    const u = taskUrgency(t, now);
    if (u === "done") done++;
    else if (u === "overdue") overdue++;
    else if (u === "due-soon") dueSoon++;
  }
  const total = tasks.length;
  const pending = total - done;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return { total, done, pending, overdue, dueSoon, pct };
}
