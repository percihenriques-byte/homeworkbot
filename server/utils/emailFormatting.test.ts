import { describe, expect, it } from "vitest";
import { escapeHtml, formatFrom } from "./emailFormatting";

describe("escapeHtml", () => {
  it("escapa & primeiro (evita dupla-escapagem)", () => {
    expect(escapeHtml("&amp;")).toBe("&amp;amp;");
  });

  it("escapa < e >", () => {
    expect(escapeHtml("<script>alert(1)</script>")).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;"
    );
  });

  it("escapa aspas duplas e simples", () => {
    expect(escapeHtml('a "b" c')).toBe("a &quot;b&quot; c");
    expect(escapeHtml("a 'b' c")).toBe("a &#39;b&#39; c");
  });

  it("preserva texto neutro", () => {
    expect(escapeHtml("Olá mundo")).toBe("Olá mundo");
  });

  it("coerce non-string", () => {
    // @ts-expect-error — testando input adverso
    expect(escapeHtml(123)).toBe("123");
    // @ts-expect-error
    expect(escapeHtml(null)).toBe("null");
  });

  it("string vazia", () => {
    expect(escapeHtml("")).toBe("");
  });
});

describe("formatFrom", () => {
  it("retorna só email quando não há nome", () => {
    expect(formatFrom("a@b.com")).toBe("a@b.com");
    expect(formatFrom("a@b.com", "")).toBe("a@b.com");
    expect(formatFrom("a@b.com", null)).toBe("a@b.com");
    expect(formatFrom("a@b.com", undefined)).toBe("a@b.com");
    expect(formatFrom("a@b.com", "   ")).toBe("a@b.com");
  });

  it("formata nome + email", () => {
    expect(formatFrom("a@b.com", "João Silva")).toBe('"João Silva" <a@b.com>');
  });

  it("remove aspas duplas do nome (impede quebra do header)", () => {
    expect(formatFrom("a@b.com", 'Jo"ão')).toBe('"João" <a@b.com>');
  });

  it("remove < e > do nome (impede injection de outro endereço)", () => {
    expect(formatFrom("a@b.com", "Joao <attacker@evil.com>")).toBe(
      '"Joao attacker@evil.com" <a@b.com>'
    );
  });

  it("remove \\r e \\n do nome (impede injection de novos headers)", () => {
    expect(formatFrom("a@b.com", "Joao\r\nBcc: evil@x.com")).toBe(
      '"JoaoBcc: evil@x.com" <a@b.com>'
    );
  });

  it("colapsa whitespace em runs", () => {
    expect(formatFrom("a@b.com", "  Joao    Silva  ")).toBe(
      '"Joao Silva" <a@b.com>'
    );
  });

  it("cai pra email só se nome vira vazio após sanitização", () => {
    expect(formatFrom("a@b.com", '"<>')).toBe("a@b.com");
    expect(formatFrom("a@b.com", "\r\n")).toBe("a@b.com");
  });

  it("preserva caracteres normais (acentos, hífens, pontos)", () => {
    expect(formatFrom("a@b.com", "Ana-Maria O. Silva")).toBe(
      '"Ana-Maria O. Silva" <a@b.com>'
    );
  });
});
