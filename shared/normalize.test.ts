import { describe, expect, it } from "vitest";
import { normalize } from "./normalize";

describe("normalize", () => {
  it("lowercase basico", () => {
    expect(normalize("PENDENTE")).toBe("pendente");
    expect(normalize("Pendente")).toBe("pendente");
  });

  it("remove acentos comuns em pt-BR", () => {
    expect(normalize("média")).toBe("media");
    expect(normalize("difícil")).toBe("dificil");
    expect(normalize("concluída")).toBe("concluida");
    expect(normalize("fácil")).toBe("facil");
  });

  it("trim whitespace", () => {
    expect(normalize("  alta  ")).toBe("alta");
    expect(normalize("\ttarefa\n")).toBe("tarefa");
  });

  it("combina capitalização + acento + whitespace", () => {
    expect(normalize("  MÉDIA  ")).toBe("media");
  });

  it("tolera null / undefined", () => {
    expect(normalize(null)).toBe("");
    expect(normalize(undefined)).toBe("");
  });

  it("converte number/boolean para string", () => {
    expect(normalize(0)).toBe("0");
    expect(normalize(true)).toBe("true");
  });

  it("preserva letras sem diacríticos", () => {
    expect(normalize("hello world")).toBe("hello world");
  });
});
