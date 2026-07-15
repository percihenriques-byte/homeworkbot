// Extrai texto puro do campo `content` de uma mensagem retornada pelo LLM.
// O provedor pode devolver:
//   - string simples ("olá")
//   - array de partes ([{type:"text", text:"olá"}, {type:"text", text:"mundo"}])
//   - null / undefined em erros
//
// Antes vivia inline em 5+ lugares (chat.message, generateCompletion,
// generateStudyGuide, etc). Extraído pra ficar tratado UMA vez, testado
// UMA vez, e não divergir silenciosamente.

export function llmText(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    return raw
      .map((p: any) => {
        if (typeof p === "string") return p;
        if (p && typeof p.text === "string") return p.text;
        return "";
      })
      .join("");
  }
  return "";
}
