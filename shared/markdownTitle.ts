// Extrai um título curto a partir de um bloco de Markdown. Usa a primeira
// heading (# até ####); se não tiver, usa a primeira linha não-vazia; se
// o resultado passar do limite, corta em `max` chars com "…".
//
// Usado no guia de estudo pra dar título mais amigável que "Guia:
// Matemática" — normalmente o LLM começa com "## Título do guia".

const HEADING_RE = /^\s*#{1,4}\s+(.+?)\s*$/m;

export function extractMarkdownTitle(
  raw: string | null | undefined,
  max: number = 80
): string | null {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) return null;

  let candidate = "";
  const heading = HEADING_RE.exec(text);
  if (heading && heading[1]) {
    candidate = heading[1].trim();
  } else {
    // Sem heading: pega a primeira linha não-vazia.
    for (const line of text.split(/\r?\n/)) {
      const l = line.trim();
      if (l.length > 0) {
        candidate = l;
        break;
      }
    }
  }
  // Remove markdown inline básico (asterisco/underscore/backtick) do candidato
  // pra não vazar "## **Título**" ou "`código`" pro campo título.
  candidate = candidate.replace(/[*_`]+/g, "").trim();
  if (!candidate) return null;

  if (candidate.length > max) {
    return candidate.slice(0, max).trimEnd() + "…";
  }
  return candidate;
}
