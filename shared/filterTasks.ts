// Filtra tarefas por status ("todas" | "pendentes" | "concluidas") e por
// substring de busca. Usado na página Tarefas — extraído pra util pura pra
// ficar testável (predicados combinados, case-insensitive, acentos).

import { normalize } from "./normalize";

export type TaskFilterInput = {
  status?: string | null;
  title?: string | null;
  description?: string | null;
  subject?: string | null;
};

export type StatusFilter = "todas" | "pendentes" | "concluidas";

export function filterTasks<T extends TaskFilterInput>(
  tasks: readonly T[],
  filter: StatusFilter,
  search: string = ""
): T[] {
  // Normalização da busca: minúscula + sem acento, pra casar "matemática"
  // com "MATEMATICA" e "materia" com "matéria".
  const q = normalize(search.trim());

  return tasks.filter((t) => {
    const done = normalize(t.status) === "concluida";
    if (filter === "pendentes" && done) return false;
    if (filter === "concluidas" && !done) return false;
    if (q) {
      const hay = normalize(
        `${t.title ?? ""} ${t.description ?? ""} ${t.subject ?? ""}`
      );
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
