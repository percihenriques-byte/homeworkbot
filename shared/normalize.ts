/**
 * Normaliza uma string para comparação case- e accent-insensitive.
 * Uso principal: comparar valores de enum que podem variar por
 * capitalização ou por presença/ausência de acentos ("Média",
 * "MEDIA", "media" → "media").
 */
export function normalize(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove combining diacritical marks
    .toLowerCase()
    .trim();
}
