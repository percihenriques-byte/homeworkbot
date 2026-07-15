import { describe, it, expect } from "vitest";
import {
  makeTokenWithSecret,
  verifyTokenWithSecret,
  signWithSecret,
} from "./simpleAuth";

const SECRET = "test-secret-que-nao-vai-vazar";
const OTHER = "outro-segredo";

describe("simpleAuth token", () => {
  it("verifica um token que ele mesmo assinou", () => {
    const tok = makeTokenWithSecret(SECRET);
    expect(verifyTokenWithSecret(tok, SECRET)).toBe(true);
  });

  it("rejeita token assinado com outro segredo", () => {
    const tok = makeTokenWithSecret(SECRET);
    expect(verifyTokenWithSecret(tok, OTHER)).toBe(false);
  });

  it("rejeita undefined, null e string vazia", () => {
    expect(verifyTokenWithSecret(undefined, SECRET)).toBe(false);
    expect(verifyTokenWithSecret(null, SECRET)).toBe(false);
    expect(verifyTokenWithSecret("", SECRET)).toBe(false);
  });

  it("rejeita token sem ponto (formato inválido)", () => {
    expect(verifyTokenWithSecret("sem-ponto", SECRET)).toBe(false);
  });

  it("rejeita token só com payload (sem assinatura)", () => {
    expect(verifyTokenWithSecret("payload.", SECRET)).toBe(false);
  });

  it("rejeita token só com assinatura (sem payload)", () => {
    expect(verifyTokenWithSecret(".sig", SECRET)).toBe(false);
  });

  it("rejeita se a assinatura foi trocada", () => {
    const tok = makeTokenWithSecret(SECRET);
    const [payload] = tok.split(".");
    const tampered = `${payload}.assinaturaFalsa`;
    expect(verifyTokenWithSecret(tampered, SECRET)).toBe(false);
  });

  it("rejeita se o payload foi trocado (assinatura não bate)", () => {
    const tok = makeTokenWithSecret(SECRET);
    const [, sig] = tok.split(".");
    const evilPayload = Buffer.from(JSON.stringify({ openId: "attacker" })).toString(
      "base64url"
    );
    const tampered = `${evilPayload}.${sig}`;
    expect(verifyTokenWithSecret(tampered, SECRET)).toBe(false);
  });

  it("tokens do mesmo segredo são estáveis (mesma sessão persiste)", () => {
    const a = makeTokenWithSecret(SECRET);
    const b = makeTokenWithSecret(SECRET);
    expect(a).toBe(b);
  });

  it("signWithSecret é determinístico", () => {
    expect(signWithSecret("mesmo", SECRET)).toBe(signWithSecret("mesmo", SECRET));
    expect(signWithSecret("A", SECRET)).not.toBe(signWithSecret("B", SECRET));
  });

  it("comparação de assinatura NÃO crasha em tamanhos diferentes (evita erro do timingSafeEqual)", () => {
    // Regressão: crypto.timingSafeEqual throws se os buffers têm tamanhos
    // diferentes. Nosso guard `a.length === b.length` deve pegar isso.
    const evil = `${Buffer.from('{"x":1}').toString("base64url")}.tam-errado`;
    expect(() => verifyTokenWithSecret(evil, SECRET)).not.toThrow();
    expect(verifyTokenWithSecret(evil, SECRET)).toBe(false);
  });
});
