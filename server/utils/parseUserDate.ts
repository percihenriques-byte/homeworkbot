// Parse tolerante de datas vindas do usuário (via ferramenta do agente ou
// input direto). Trata o caso mais chato do JS: `new Date("2026-07-18")`
// é meia-noite UTC → em pt-BR (UTC-3) exibe como o dia ANTERIOR ("17/07").
// Aqui, se a string for uma DATA PURA "AAAA-MM-DD", fixamos no MEIO-DIA
// LOCAL. Assim o prazo cai no dia certo em qualquer fuso do Brasil.

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseUserDate(value: unknown): Date | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim();
  if (!v) return undefined;

  const m = DATE_ONLY.exec(v);
  if (m) {
    const [, y, mo, d] = m;
    const Y = Number(y), M = Number(mo), D = Number(d);
    // Rejeita range inválido — JS normalizaria em silêncio (mês 13 vira
    // Jan do ano seguinte, dia 45 rola pra Fev, etc). Melhor devolver
    // undefined que salvar tarefa com prazo TOTALMENTE errado.
    if (M < 1 || M > 12 || D < 1 || D > 31) return undefined;
    // Meio-dia local: se o fuso mudar (UTC-3, UTC-2 no horário de verão),
    // continua caindo no mesmo dia do calendário local.
    const dt = new Date(Y, M - 1, D, 12, 0, 0);
    if (dt.getFullYear() !== Y || dt.getMonth() !== M - 1 || dt.getDate() !== D) {
      return undefined; // pega 30/fev, 31/abril, 29/fev fora de bissexto
    }
    return dt;
  }

  // Qualquer outro formato: delega pro Date. Se der Invalid Date, retorna
  // undefined em vez de propagar NaN.
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : undefined;
}
