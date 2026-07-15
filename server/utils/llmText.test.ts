import { describe, expect, it } from "vitest";
import { llmText } from "./llmText";

describe("llmText", () => {
  it("string simples volta como está", () => {
    expect(llmText("olá")).toBe("olá");
  });

  it("string vazia é aceita", () => {
    expect(llmText("")).toBe("");
  });

  it("array de strings é concatenado", () => {
    expect(llmText(["a", "b", "c"])).toBe("abc");
  });

  it("array de objetos com .text é concatenado", () => {
    expect(
      llmText([
        { type: "text", text: "olá " },
        { type: "text", text: "mundo" },
      ])
    ).toBe("olá mundo");
  });

  it("mistura de string e objeto no array", () => {
    expect(llmText(["a ", { text: "b " }, "c"])).toBe("a b c");
  });

  it("null / undefined → string vazia", () => {
    expect(llmText(null)).toBe("");
    expect(llmText(undefined)).toBe("");
  });

  it("número, boolean, objeto plano → string vazia", () => {
    expect(llmText(42)).toBe("");
    expect(llmText(true)).toBe("");
    expect(llmText({})).toBe("");
  });

  it("objeto no array sem .text é ignorado (não vira 'undefined')", () => {
    expect(llmText([{ type: "image_url" }, { text: "só isso" }])).toBe("só isso");
  });

  it("objeto no array com .text não-string é ignorado", () => {
    expect(llmText([{ text: null }, { text: 42 }, { text: "válido" }])).toBe("válido");
  });

  it("array vazio → string vazia", () => {
    expect(llmText([])).toBe("");
  });

  it("nunca lança pra qualquer input", () => {
    expect(() => llmText(new Date())).not.toThrow();
    expect(() => llmText(Symbol("x") as any)).not.toThrow();
  });
});
