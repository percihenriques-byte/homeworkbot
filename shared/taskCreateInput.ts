// Mapeia uma tarefa existente (do banco / react-query) pro payload que a
// mutation tasks.create espera. Usado tanto no "Duplicar" (mesmo título +
// (cópia)) quanto no "Desfazer" (recria com o título original).
//
// Puro e testável — as duas chamadas no Tasks.tsx antes compartilhavam o
// mesmo mapping inline. Se um campo novo aparecer na tarefa, atualiza aqui
// e ambos ganham.

export type TaskLike = {
  title?: string | null;
  description?: string | null;
  dueDate?: Date | string | null;
  difficulty?: string | null;
  priority?: string | null;
  type?: string | null;
  subject?: string | null;
  notes?: string | null;
};

export type CreateTaskPayload = {
  title: string;
  description?: string;
  dueDate?: Date;
  difficulty?: string;
  priority?: string;
  type?: string;
  subject?: string;
  notes?: string;
};

/**
 * Converte uma task (com campos possivelmente null/undefined) no payload
 * que tasks.create espera (Zod schema com strings max-length + Date).
 *
 * - Strings vazias/null viram undefined (Zod trata undefined ≠ "").
 * - dueDate string ISO vira Date; inválida vira undefined.
 * - Opcional overrideTitle usado pelo botão "Duplicar" pra prefixar
 *   "(cópia)" no fim.
 */
export function taskToCreateInput(
  task: TaskLike,
  overrideTitle?: string
): CreateTaskPayload {
  const title = overrideTitle ?? String(task.title ?? "");
  const payload: CreateTaskPayload = { title };

  if (task.description) payload.description = String(task.description);
  if (task.dueDate) {
    const d = task.dueDate instanceof Date ? task.dueDate : new Date(task.dueDate);
    if (Number.isFinite(d.getTime())) payload.dueDate = d;
  }
  if (task.difficulty) payload.difficulty = String(task.difficulty);
  if (task.priority) payload.priority = String(task.priority);
  if (task.type) payload.type = String(task.type);
  if (task.subject) payload.subject = String(task.subject);
  if (task.notes) payload.notes = String(task.notes);

  return payload;
}
