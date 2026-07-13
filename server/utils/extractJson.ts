/**
 * Extrai um objeto/array JSON de uma resposta bruta do LLM.
 *
 * Cobre casos comuns:
 *   1. JSON puro (`{"foo": 1}` ou `[1,2,3]`)
 *   2. Cercado por code fence (```json\n...\n``` ou ```\n...\n```)
 *   3. Misturado com texto explicativo antes/depois (procura primeiro
 *      objeto/array balanceado com contador de profundidade)
 *
 * Retorna `null` se nada rola. Nunca lança.
 */
export function extractJson<T = unknown>(raw: unknown): T | null {
  const str =
    typeof raw === "string"
      ? raw
      : Array.isArray(raw)
        ? raw.map((p: any) => (typeof p === "string" ? p : p?.text ?? "")).join("")
        : String(raw ?? "");
  if (!str) return null;

  // Tentativa 1: JSON puro
  try {
    return JSON.parse(str) as T;
  } catch {}

  // Tentativa 2: fenced code block ```json ... ``` ou ``` ... ```
  const fenced = str.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    try {
      return JSON.parse(fenced[1].trim()) as T;
    } catch {}
  }

  // Tentativa 3: primeiro { ... } ou [ ... ] balanceado
  const firstArray = str.indexOf("[");
  const firstObject = str.indexOf("{");
  const start =
    firstArray === -1
      ? firstObject
      : firstObject === -1
        ? firstArray
        : Math.min(firstArray, firstObject);
  if (start >= 0) {
    const open = str[start];
    const close = open === "[" ? "]" : "}";
    let depth = 0;
    for (let i = start; i < str.length; i++) {
      if (str[i] === open) depth++;
      else if (str[i] === close) {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(str.slice(start, i + 1)) as T;
          } catch {}
          break;
        }
      }
    }
  }
  return null;
}
