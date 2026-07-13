import { describe, expect, it } from "vitest";
import { friendlyEmailError } from "./friendlyEmailError";

describe("friendlyEmailError", () => {
  it("traduz Invalid login (Gmail)", () => {
    const result = friendlyEmailError(new Error("Invalid login: 535-5.7.8 Username and Password not accepted"));
    expect(result).toContain("Senha de App");
  });

  it("traduz BadCredentials", () => {
    const result = friendlyEmailError(new Error("Auth error: BadCredentials"));
    expect(result).toContain("Senha de App");
  });

  it("traduz Missing credentials", () => {
    const result = friendlyEmailError(new Error("Missing credentials for PLAIN"));
    expect(result).toContain("Preencha ambos");
  });

  it("traduz ETIMEDOUT", () => {
    const result = friendlyEmailError(new Error("connect ETIMEDOUT 173.194.68.109:465"));
    expect(result).toContain("Tempo esgotado");
  });

  it("traduz timeout genérico", () => {
    const result = friendlyEmailError(new Error("request timeout"));
    expect(result).toContain("Tempo esgotado");
  });

  it("traduz ECONNREFUSED", () => {
    const result = friendlyEmailError(new Error("connect ECONNREFUSED 127.0.0.1:465"));
    expect(result).toContain("Conexão recusada");
  });

  it("cai no fallback pra erro desconhecido", () => {
    const result = friendlyEmailError(new Error("something totally unrelated"));
    expect(result).toContain("Verifique as credenciais");
  });

  it("tolera null / undefined / objeto sem message", () => {
    expect(friendlyEmailError(null)).toBeTruthy();
    expect(friendlyEmailError(undefined)).toBeTruthy();
    expect(friendlyEmailError({})).toBeTruthy();
  });

  it("tolera string cru", () => {
    // Não crasha mesmo se receber algo estranho
    expect(() => friendlyEmailError("just a string")).not.toThrow();
  });

  it("sempre retorna string não-vazia", () => {
    const results = [null, undefined, {}, new Error(""), new Error("foo"), "bar"].map(
      friendlyEmailError
    );
    for (const r of results) {
      expect(r).toBeTypeOf("string");
      expect(r.length).toBeGreaterThan(0);
    }
  });
});
