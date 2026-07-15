// Chave de dedup pra tarefas: (título normalizado + dia do prazo local em
// ISO). Antes duplicado em toddleSync.ts e routers.ts (importIcs). Junta
// as duas partes de forma comparável pra distinguir "Prova de Mat"
// entregue dia 20/07 de outra entregue dia 21/07.

/**
 * Devolve `<titulo-trimado-minusculo>|<yyyy-mm-dd|">` pra usar em Set/Map
 * de dedup. `due` null → só o título (útil pra tarefas sem prazo).
 *
 * A data usa UTC → `.toISOString().slice(0,10)` — no comparison dedup
 * intra-request isso é consistente porque as duas pontas (banco e ICS)
 * passam pela mesma função. Um evento em 20/07 UTC-3 (que é 21/07 UTC)
 * vai ter mesma chave se ambos os lados vieram do mesmo timestamp.
 */
export function taskDedupKey(
  title: string | null | undefined,
  due: Date | string | null | undefined
): string {
  const t = (title ?? "").trim().toLowerCase();
  let day = "";
  if (due) {
    const d = due instanceof Date ? due : new Date(due);
    const ms = d.getTime();
    if (Number.isFinite(ms)) {
      day = d.toISOString().slice(0, 10);
    }
  }
  return `${t}|${day}`;
}
