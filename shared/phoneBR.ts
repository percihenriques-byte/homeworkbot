// Classifica um telefone BR pra dar feedback inline em Settings
// (WhatsApp). Faz três coisas: extrai só dígitos, avalia se é um
// número válido pro WhatsApp (>= 8 dígitos, coerente com wa.me), e
// formata pra exibição amigável.
//
// NÃO pretende ser um validador de operadora ou de número existente —
// só forma. Puro (sem I/O), testável.

export type PhoneClassification =
  | { ok: true; digits: string; e164: string; pretty: string }
  | { ok: false; reason: PhoneError; message: string };

export type PhoneError = "empty" | "too-short" | "too-long";

const MESSAGES: Record<PhoneError, string> = {
  empty: "",
  "too-short": "Poucos dígitos. Inclua DDD (ex: 11 99999-9999) ou país + DDD (ex: +55 11 99999-9999).",
  "too-long": "Muitos dígitos — parece que sobrou algo. Um número BR tem no máximo 13 dígitos com o +55.",
};

/**
 * Classifica um telefone.
 *   - empty: string vazia — não erra, só sinaliza.
 *   - < 8 dígitos: too-short.
 *   - > 15 dígitos (E.164 max): too-long.
 *   - Caso contrário: ok, com formato pretty pra exibição.
 *
 * `pretty` cobre os formatos comuns:
 *   9 dígitos (só o número, sem DDD) → 9 9999-9999
 *   10 dígitos (DDD + fixo)          → (11) 9999-9999
 *   11 dígitos (DDD + celular)       → (11) 99999-9999
 *   12/13 dígitos (com país 55)      → +55 (11) 99999-9999
 * Qualquer outra contagem → devolve os dígitos separados por espaço a cada 4.
 */
export function classifyPhoneBR(
  raw: string | null | undefined
): PhoneClassification {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return { ok: false, reason: "empty", message: MESSAGES.empty };
  if (digits.length < 8)
    return { ok: false, reason: "too-short", message: MESSAGES["too-short"] };
  if (digits.length > 15)
    return { ok: false, reason: "too-long", message: MESSAGES["too-long"] };

  const e164 = "+" + digits;
  const pretty = formatPretty(digits);
  return { ok: true, digits, e164, pretty };
}

function formatPretty(digits: string): string {
  // Casos com país 55 explícito
  if (digits.length === 13 && digits.startsWith("55")) {
    // 55 + DD + 9 + XXXXXXXX
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 12 && digits.startsWith("55")) {
    // 55 + DD + XXXXXXXX (fixo)
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  // Sem país
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 9) {
    return `${digits.slice(0, 1)} ${digits.slice(1, 5)}-${digits.slice(5)}`;
  }
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }
  // Formato incomum — devolve com espaço a cada 4 dígitos pra ficar legível.
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
}
