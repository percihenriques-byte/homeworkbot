// Formatação de datas pt-BR com fallback amigável pra hoje/amanhã/etc.
// Antes tinha `new Date(...).toLocaleDateString("pt-BR")` inline em 7
// lugares — quando quiséssemos passar a mostrar "amanhã" em vez de
// "16/07/2026" teríamos que caçar todos.
//
// Puro (sem I/O) — mesmo `now` produz o mesmo output.

export type FormatDateOptions = {
  /** Ponto de referência pro cálculo relativo. Default: agora. */
  now?: Date;
  /**
   * Se true, retorna rótulos relativos quando a data está em ± 7 dias:
   *   "hoje" | "amanhã" | "ontem" | "em 3 dias" | "3 dias atrás".
   * Fora dessa janela, cai no formato pt-BR (16/07/2026).
   *
   * Default: false (só formatação pt-BR).
   */
  relative?: boolean;
};

/**
 * Formata uma data (Date, string ISO, timestamp) em pt-BR.
 * Retorna string vazia pra input inválido/null/undefined — pra o caller
 * poder concatenar sem risco de NaN/undefined vazando pra UI.
 */
export function formatDate(
  raw: Date | string | number | null | undefined,
  opts: FormatDateOptions = {}
): string {
  if (raw === null || raw === undefined) return "";
  const d = raw instanceof Date ? raw : new Date(raw);
  const t = d.getTime();
  if (!Number.isFinite(t)) return "";

  if (opts.relative) {
    const label = relativeLabel(d, opts.now ?? new Date());
    if (label) return label;
  }

  return d.toLocaleDateString("pt-BR");
}

function relativeLabel(target: Date, now: Date): string | null {
  const dayKey = (d: Date) =>
    `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const today = dayKey(now);
  if (dayKey(target) === today) return "hoje";

  const dayMs = 24 * 60 * 60 * 1000;
  // Diferença em dias arredondada — compara start-of-day pra evitar
  // "23h de diferença = 0 dias" produzir "hoje" pra amanhã de manhã.
  const startTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const startNow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diffDays = Math.round((startTarget - startNow) / dayMs);

  if (diffDays === 1) return "amanhã";
  if (diffDays === -1) return "ontem";
  if (diffDays > 1 && diffDays <= 7) return `em ${diffDays} dias`;
  if (diffDays < -1 && diffDays >= -7) return `${-diffDays} dias atrás`;
  return null;
}
