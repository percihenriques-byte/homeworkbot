import { describe, it, expect, vi, afterEach } from "vitest";
import {
  hashPassword,
  verifyPassword,
  makeSessionToken,
  openIdFromToken,
  openIdForEmail,
} from "./passwordAuth";

describe("hashPassword / verifyPassword", () => {
  it("gera 'salt:hash' e valida a senha correta", () => {
    const h = hashPassword("minhaSenha123");
    expect(h).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
    expect(verifyPassword("minhaSenha123", h)).toBe(true);
  });

  it("rejeita senha errada", () => {
    const h = hashPassword("certa");
    expect(verifyPassword("errada", h)).toBe(false);
  });

  it("hashes diferentes pra mesma senha (salt aleatório)", () => {
    expect(hashPassword("x")).not.toBe(hashPassword("x"));
  });

  it("não quebra com hash inválido/ausente", () => {
    expect(verifyPassword("x", null)).toBe(false);
    expect(verifyPassword("x", "")).toBe(false);
    expect(verifyPassword("x", "lixo-sem-doispontos")).toBe(false);
  });
});

describe("sessão (token assinado)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("round-trip: makeSessionToken → openIdFromToken", () => {
    vi.stubEnv("JWT_SECRET", "segredo-teste");
    const t = makeSessionToken("pw:abc123");
    expect(openIdFromToken(t)).toBe("pw:abc123");
  });

  it("token adulterado → null", () => {
    vi.stubEnv("JWT_SECRET", "segredo-teste");
    const t = makeSessionToken("pw:abc123");
    const tampered = t.slice(0, -3) + "xxx";
    expect(openIdFromToken(tampered)).toBeNull();
  });

  it("assinado com outro segredo → null (não aceita)", () => {
    vi.stubEnv("JWT_SECRET", "segredo-A");
    const t = makeSessionToken("pw:abc123");
    vi.stubEnv("JWT_SECRET", "segredo-B");
    expect(openIdFromToken(t)).toBeNull();
  });

  it("lixo → null", () => {
    expect(openIdFromToken(undefined)).toBeNull();
    expect(openIdFromToken("")).toBeNull();
    expect(openIdFromToken("sem-ponto")).toBeNull();
  });
});

describe("openIdForEmail", () => {
  it("estável, case-insensitive e cabe em 64 chars", () => {
    const a = openIdForEmail("Aluno@Teste.com");
    const b = openIdForEmail("  aluno@teste.com ");
    expect(a).toBe(b);
    expect(a.startsWith("pw:")).toBe(true);
    expect(a.length).toBeLessThanOrEqual(64);
  });

  it("e-mails diferentes → openIds diferentes", () => {
    expect(openIdForEmail("a@x.com")).not.toBe(openIdForEmail("b@x.com"));
  });
});
