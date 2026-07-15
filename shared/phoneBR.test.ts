import { describe, expect, it } from "vitest";
import { classifyPhoneBR } from "./phoneBR";

describe("classifyPhoneBR", () => {
  it("vazio → empty", () => {
    const r = classifyPhoneBR("");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("empty");
  });

  it("só formatação (sem dígitos) → empty", () => {
    const r = classifyPhoneBR("()- .");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("empty");
  });

  it("< 8 dígitos → too-short", () => {
    for (const s of ["1", "1234567"]) {
      const r = classifyPhoneBR(s);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe("too-short");
    }
  });

  it("> 15 dígitos → too-long", () => {
    const r = classifyPhoneBR("1".repeat(16));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("too-long");
  });

  it("celular BR completo (13 dígitos com 55)", () => {
    const r = classifyPhoneBR("+55 11 99999-9999");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.digits).toBe("5511999999999");
      expect(r.e164).toBe("+5511999999999");
      expect(r.pretty).toBe("+55 (11) 99999-9999");
    }
  });

  it("celular sem país (11 dígitos)", () => {
    const r = classifyPhoneBR("11 99999-9999");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.pretty).toBe("(11) 99999-9999");
  });

  it("fixo sem país (10 dígitos)", () => {
    const r = classifyPhoneBR("11 3333-4444");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.pretty).toBe("(11) 3333-4444");
  });

  it("fixo com país (12 dígitos)", () => {
    const r = classifyPhoneBR("+551133334444");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.pretty).toBe("+55 (11) 3333-4444");
  });

  it("9 dígitos (só celular, sem DDD)", () => {
    const r = classifyPhoneBR("999999999");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.pretty).toBe("9 9999-9999");
  });

  it("8 dígitos (fixo local)", () => {
    const r = classifyPhoneBR("33334444");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.pretty).toBe("3333-4444");
  });

  it("null/undefined → empty (não crasha)", () => {
    expect(classifyPhoneBR(null).ok).toBe(false);
    expect(classifyPhoneBR(undefined).ok).toBe(false);
  });

  it("dígitos com muitos separadores diferentes são normalizados", () => {
    const r = classifyPhoneBR("+55 (11) 99999.9999");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.digits).toBe("5511999999999");
  });

  it("mensagens PT-BR pros erros", () => {
    const short = classifyPhoneBR("123");
    if (!short.ok) expect(short.message).toContain("DDD");
    const long = classifyPhoneBR("1".repeat(20));
    if (!long.ok) expect(long.message).toContain("Muitos");
  });

  it("comprimento incomum (14 dígitos) → ok mas pretty vira agrupamento genérico", () => {
    const r = classifyPhoneBR("12345678901234");
    expect(r.ok).toBe(true);
    if (r.ok) {
      // Formato incomum — só separa em grupos legíveis
      expect(r.pretty).toContain(" ");
    }
  });
});
