// Filtra tarefas por status (todas | pendentes | concluidas | atrasadas)
// e por substring de busca. Usado na página Tarefas — extraído pra util
// pura pra ficar testável (predicados combinados, case-insensitive,
// acentos, urgência com fuso).

import { normalize } from "./normalize";
import { isOverdue } from "./taskUrgency";

export type TaskFilterInput = {
  status?: string | null;
  title?: string | null;
  description?: string | null;
  subject?: string | null;
  dueDate?: Date | string | null;
};

export type StatusFilter = "todas" | "pendentes" | "concluidas" | "atrasadas";

export function filterTasks<T extends TaskFilterInput>(
  tasks: readonly T[],
  filter: StatusFilter,
  search: string = "",
  now?: Date
): T[] {
  // Normalização da busca: minúscula + sem acento, pra casar "matemática"
  // com "MATEMATICA" e "materia" com "matéria".
  const q = normalize(search.trim());

  return tasks.filter((t) => {
    const done = normalize(t.status) === "concluida";
    if (filter === "pendentes" && done) return false;
    if (filter === "concluidas" && !done) return false;
    if (filter === "atrasadas" && !isOverdue(t, now)) return false;
    if (q) {
      const hay = normalize(
        `${t.title ?? ""} ${t.description ?? ""} ${t.subject ?? ""}`
      );
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
