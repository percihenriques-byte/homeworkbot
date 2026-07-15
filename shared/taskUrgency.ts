// Classifica urgência de uma tarefa pelo status e prazo. Usado em vários
// lugares (Tarefas, Dashboard, futuros lembretes) — extraído pra util
// pra evitar divergência entre implementações.

import { normalize } from "./normalize";

export type Urgency = "done" | "overdue" | "due-soon" | "future" | "no-date";

const DAY_MS = 24 * 60 * 60 * 1000;

export type UrgencyInput = {
  status?: string | null;
  dueDate?: Date | string | null;
};

/**
 * Retorna a urgência da tarefa relativa a `now` (default: agora):
 *   - "done": status concluída (independente de prazo)
 *   - "overdue": pendente + prazo no passado
 *   - "due-soon": pendente + prazo entre agora e +24h
 *   - "future": pendente + prazo > 24h no futuro
 *   - "no-date": pendente sem prazo
 */
export function taskUrgency(task: UrgencyInput, now: Date = new Date()): Urgency {
  if (normalize(task.status) === "concluida") return "done";
  if (!task.dueDate) return "no-date";
  const dueMs = new Date(task.dueDate).getTime();
  if (!Number.isFinite(dueMs)) return "no-date";
  const nowMs = now.getTime();
  if (dueMs < nowMs) return "overdue";
  if (dueMs < nowMs + DAY_MS) return "due-soon";
  return "future";
}

/** Atalho: `taskUrgency(t) === "overdue"`. */
export function isOverdue(task: UrgencyInput, now?: Date): boolean {
  return taskUrgency(task, now) === "overdue";
}

/** Atalho: `taskUrgency(t) === "due-soon"`. */
export function isDueSoon(task: UrgencyInput, now?: Date): boolean {
  return taskUrgency(task, now) === "due-soon";
}
