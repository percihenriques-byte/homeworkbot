import { describe, expect, it } from "vitest";
import { parseUserDate } from "./parseUserDate";

describe("parseUserDate", () => {
  it("string vazia/whitespace → undefined", () => {
    expect(parseUserDate("")).toBeUndefined();
    expect(parseUserDate("   ")).toBeUndefined();
    expect(parseUserDate("\t\n")).toBeUndefined();
  });

  it("não-string → undefined (nunca joga)", () => {
    expect(parseUserDate(undefined)).toBeUndefined();
    expect(parseUserDate(null)).toBeUndefined();
    expect(parseUserDate(42)).toBeUndefined();
    expect(parseUserDate({})).toBeUndefined();
    expect(parseUserDate([])).toBeUndefined();
  });

  it("string inválida → undefined (não NaN)", () => {
    expect(parseUserDate("amanhã")).toBeUndefined();
    expect(parseUserDate("not a date")).toBeUndefined();
    expect(parseUserDate("2026-13-45")).toBeUndefined();
  });

  it("AAAA-MM-DD fixa no meio-dia LOCAL (não UTC)", () => {
    const d = parseUserDate("2026-07-18");
    expect(d).toBeDefined();
    // Meio-dia local (12:00). Nunca deve virar dia 17 por causa do fuso.
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(6); // julho (0-indexed)
    expect(d!.getDate()).toBe(18);
    expect(d!.getHours()).toBe(12);
  });

  it("AAAA-MM-DD com espaços em volta → ok", () => {
    const d = parseUserDate("  2026-01-01  ");
    expect(d).toBeDefined();
    expect(d!.getDate()).toBe(1);
    expect(d!.getMonth()).toBe(0);
  });

  it("ISO completo com horário → passa direto pro Date", () => {
    const d = parseUserDate("2026-07-18T15:30:00Z");
    expect(d).toBeDefined();
    expect(d!.getTime()).toBe(new Date("2026-07-18T15:30:00Z").getTime());
  });

  it("formato regional simples também aceito (Date parse)", () => {
    // Date.parse aceita alguns formatos além do ISO. Contanto que não
    // retorne NaN, aceitamos.
    const d = parseUserDate("July 18, 2026");
    // Alguns engines aceitam, outros não — o contrato é: se aceita, não
    // é NaN; se não aceita, é undefined. Ambos são válidos.
    if (d) {
      expect(Number.isFinite(d.getTime())).toBe(true);
    }
  });

  it("bug histórico: '2026-07-18' NÃO cai no dia 17 em pt-BR", () => {
    // Regression test do bug que motivou este util: se usasse
    // `new Date("2026-07-18")`, seria 2026-07-18T00:00:00Z = 2026-07-17
    // 21:00 em UTC-3, e `.getDate()` retornaria 17.
    const d = parseUserDate("2026-07-18")!;
    expect(d.getDate()).toBe(18);
  });

  it("dia 1 do mês", () => {
    const d = parseUserDate("2026-03-01")!;
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(1);
  });

  it("31 de dezembro", () => {
    const d = parseUserDate("2026-12-31")!;
    expect(d.getMonth()).toBe(11);
    expect(d.getDate()).toBe(31);
  });

  it("rejeita mês 13 e mês 00 (não normaliza silenciosamente)", () => {
    expect(parseUserDate("2026-13-01")).toBeUndefined();
    expect(parseUserDate("2026-00-15")).toBeUndefined();
  });

  it("rejeita dia 32 e 30/fev", () => {
    expect(parseUserDate("2026-01-32")).toBeUndefined();
    expect(parseUserDate("2026-02-30")).toBeUndefined();
    expect(parseUserDate("2026-04-31")).toBeUndefined();
  });

  it("29/fev só em ano bissexto", () => {
    expect(parseUserDate("2026-02-29")).toBeUndefined(); // não bissexto
    expect(parseUserDate("2028-02-29")).toBeDefined(); // bissexto
  });
});
