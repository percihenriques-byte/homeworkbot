// Predicate: uma tarefa é "pendente" quando NÃO tem completedAt E o status
// (normalizado) não é "concluida". Extraído do server/routers.ts e
// agentTools — a checagem dupla protege contra dados antigos onde o
// server ainda não tocava completedAt quando o status virava "concluída".

import { normalize } from "./normalize";

export type PendingInput = {
  completedAt?: Date | string | null | undefined;
  status?: string | null | undefined;
};

/**
 * `true` quando a tarefa ainda precisa ser feita:
 *   - `completedAt` ausente (null/undefined) **e**
 *   - `status` normalizado ≠ "concluida"
 */
export function isPendingTask(task: PendingInput): boolean {
  if (task.completedAt) return false;
  if (normalize(task.status) === "concluida") return false;
  return true;
}
