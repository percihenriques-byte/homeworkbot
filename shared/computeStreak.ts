/**
 * Calcula quantos dias CONSECUTIVOS ate hoje (inclusive) o usuário
 * teve pelo menos uma atividade registrada em qualquer uma das datas
 * passadas.
 *
 * - Datas são normalizadas para YYYY-MM-DD no fuso local.
 * - null/undefined/inválidas são ignoradas.
 * - Para no primeiro dia sem atividade indo para trás.
 * - Se hoje não tem atividade, streak = 0 (dia atual é a exigência).
 * - Cap em 365 iterações pra proteger contra loop maluco.
 *
 * @param dates Datas de atividade (Date, string ISO, ou timestamp).
 * @param now Ponto de referência (default: agora). Facilita testes.
 */
export function computeStreak(
  dates: ReadonlyArray<Date | string | number | null | undefined>,
  now: Date = new Date()
): number {
  const active = new Set<string>();
  for (const d of dates) {
    if (d === null || d === undefined) continue;
    const parsed = d instanceof Date ? d : new Date(d);
    const t = parsed.getTime();
    if (!Number.isFinite(t)) continue;
    active.add(toLocalIso(parsed));
  }

  let count = 0;
  const cursor = new Date(now.getTime());
  cursor.setHours(0, 0, 0, 0);
  for (let i = 0; i < 365; i++) {
    if (!active.has(toLocalIso(cursor))) break;
    count++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

/** Converte Date para YYYY-MM-DD no fuso LOCAL (não UTC). */
function toLocalIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
