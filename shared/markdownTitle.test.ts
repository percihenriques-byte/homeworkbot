import { describe, expect, it } from "vitest";
import { extractMarkdownTitle } from "./markdownTitle";

describe("extractMarkdownTitle", () => {
  it("string vazia / null / undefined → null", () => {
    expect(extractMarkdownTitle("")).toBeNull();
    expect(extractMarkdownTitle("   ")).toBeNull();
    expect(extractMarkdownTitle(null)).toBeNull();
    expect(extractMarkdownTitle(undefined)).toBeNull();
  });

  it("pega primeiro # heading", () => {
    expect(extractMarkdownTitle("# Meu Guia\n\nConteúdo")).toBe("Meu Guia");
  });

  it("pega primeiro ## heading (mais comum em guias gerados)", () => {
    expect(extractMarkdownTitle("## Introdução à Matemática\n\ntexto")).toBe(
      "Introdução à Matemática"
    );
  });

  it("aceita até #### (H4)", () => {
    expect(extractMarkdownTitle("#### H4\n\ntexto")).toBe("H4");
  });

  it("ignora prosa antes do heading, pega o primeiro heading", () => {
    const md = "Aqui vai um guia:\n\n## Título Real\n\nMais texto\n\n## Outra";
    expect(extractMarkdownTitle(md)).toBe("Título Real");
  });

  it("remove markdown inline básico do heading (**bold**, `code`, _underscore_)", () => {
    expect(extractMarkdownTitle("## **Título** _importante_")).toBe(
      "Título importante"
    );
    expect(extractMarkdownTitle("## Titulo com `código`")).toBe(
      "Titulo com código"
    );
  });

  it("sem heading → primeira linha não-vazia", () => {
    expect(extractMarkdownTitle("\n\nPrimeira linha\nSegunda linha")).toBe(
      "Primeira linha"
    );
  });

  it("trunca em max chars com …", () => {
    const longTitle = "## " + "a".repeat(200);
    const r = extractMarkdownTitle(longTitle, 50);
    expect(r).toBe("a".repeat(50) + "…");
  });

  it("respeita max customizado", () => {
    // max=5 → slice(0,5) de "Título muito longo aqui" = "Títul" + "…".
    expect(extractMarkdownTitle("## Título muito longo aqui", 5)).toBe("Títul…");
  });

  it("não corta se cabe em max", () => {
    expect(extractMarkdownTitle("## Curto", 80)).toBe("Curto");
  });

  it("heading com espaços extras → trim", () => {
    expect(extractMarkdownTitle("##   Espaçado   ")).toBe("Espaçado");
  });

  it("heading vazio (só #) → fallback pra primeira linha", () => {
    // "#" sozinho não bate na regex (\s+ requer 1+ espaço + conteúdo).
    expect(extractMarkdownTitle("#\n\nConteudo")).toBe("Conteudo");
  });

  it("nunca retorna string vazia (retorna null se só markup)", () => {
    expect(extractMarkdownTitle("## **`_`**")).toBeNull();
  });

  it("aceita CRLF (Windows)", () => {
    expect(extractMarkdownTitle("## Header\r\n\r\nBody")).toBe("Header");
  });
});
