// Ordenação canônica de tarefas usada na página Tarefas + Dashboard.
// Regra: não-concluídas primeiro → prioridade alta > média > baixa →
// data mais próxima primeiro.
//
// Puro (sem I/O). Recebe qualquer objeto que tenha os campos usados.

import { normalize } from "./normalize";

export type SortableTask = {
  status?: string | null;
  priority?: string | null;
  dueDate?: Date | string | null;
};

const priorityRank: Record<string, number> = { alta: 0, media: 1, baixa: 2 };

function statusRank(s: SortableTask): number {
  return normalize(s.status) === "concluida" ? 1 : 0;
}

function prioRank(s: SortableTask): number {
  return priorityRank[normalize(s.priority)] ?? 3;
}

function dueMs(s: SortableTask): number {
  return s.dueDate ? new Date(s.dueDate).getTime() : Infinity;
}

/**
 * Compara duas tarefas na ordem canônica. Uso: `tasks.sort(compareTasks)`.
 * Retorna:
 *   < 0  se a vem antes de b
 *   > 0  se b vem antes de a
 *   0    se são equivalentes
 */
export function compareTasks(a: SortableTask, b: SortableTask): number {
  const s = statusRank(a) - statusRank(b);
  if (s !== 0) return s;
  const p = prioRank(a) - prioRank(b);
  if (p !== 0) return p;
  return dueMs(a) - dueMs(b);
}

/**
 * Retorna uma cópia ordenada — não muta o array de entrada. Útil pra
 * evitar bug de "sort mutou a query-cache do react-query".
 */
export function sortTasks<T extends SortableTask>(list: readonly T[]): T[] {
  return [...list].sort(compareTasks);
}
