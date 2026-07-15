import { describe, expect, it } from "vitest";
import { validateFlashcards, validateQuizQuestions } from "./validateAiOutput";

describe("validateFlashcards", () => {
  it("array vazio → vazio", () => {
    expect(validateFlashcards([])).toEqual([]);
  });

  it("não-array → vazio (não crasha com null/undefined/objeto)", () => {
    expect(validateFlashcards(null)).toEqual([]);
    expect(validateFlashcards(undefined)).toEqual([]);
    expect(validateFlashcards({})).toEqual([]);
    expect(validateFlashcards("string")).toEqual([]);
  });

  it("mantém cards com question + answer preenchidos", () => {
    const r = validateFlashcards([
      { question: "O que é X?", answer: "X é isso." },
    ]);
    expect(r).toEqual([{ question: "O que é X?", answer: "X é isso." }]);
  });

  it("descarta cards com question vazia ou só espaço", () => {
    const r = validateFlashcards([
      { question: "", answer: "a" },
      { question: "   ", answer: "a" },
      { question: null, answer: "a" },
      { question: undefined, answer: "a" },
      { question: 42, answer: "a" }, // não-string
    ]);
    expect(r).toEqual([]);
  });

  it("descarta cards com answer vazia", () => {
    const r = validateFlashcards([
      { question: "P", answer: "" },
      { question: "P", answer: "  " },
      { question: "P", answer: null },
    ]);
    expect(r).toEqual([]);
  });

  it("mistura de válidos e inválidos → só volta os válidos", () => {
    const r = validateFlashcards([
      { question: "P1", answer: "R1" },
      { question: "", answer: "R" },
      { question: "P3", answer: "R3", difficulty: "fácil" },
      null,
      { random: "obj" },
    ]);
    expect(r).toHaveLength(2);
    expect(r[0].question).toBe("P1");
    expect(r[1].question).toBe("P3");
    expect(r[1].difficulty).toBe("fácil");
  });

  it("difficulty é opcional; strings vazias/não-strings são omitidas", () => {
    const r = validateFlashcards([
      { question: "P", answer: "R", difficulty: "" },
      { question: "P2", answer: "R", difficulty: 42 },
      { question: "P3", answer: "R" },
    ]);
    for (const c of r) {
      expect(c.difficulty).toBeUndefined();
    }
  });
});

describe("validateQuizQuestions", () => {
  it("array vazio → vazio", () => {
    expect(validateQuizQuestions([])).toEqual([]);
  });

  it("null/undefined/objeto/string → vazio", () => {
    expect(validateQuizQuestions(null)).toEqual([]);
    expect(validateQuizQuestions({ questions: [] })).toEqual([]);
    expect(validateQuizQuestions("x")).toEqual([]);
  });

  it("questão válida passa", () => {
    const r = validateQuizQuestions([
      { question: "P?", options: ["A", "B", "C"], correctAnswer: "A" },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].options).toEqual(["A", "B", "C"]);
  });

  it("options < 2 → descartada (quiz de 1 opção não faz sentido)", () => {
    const r = validateQuizQuestions([
      { question: "P?", options: ["A"], correctAnswer: "A" },
    ]);
    expect(r).toEqual([]);
  });

  it("options não-array → descartada", () => {
    const r = validateQuizQuestions([
      { question: "P?", options: "not-array", correctAnswer: "A" },
      { question: "P?", options: null, correctAnswer: "A" },
    ]);
    expect(r).toEqual([]);
  });

  it("question vazia/null → descartada", () => {
    const r = validateQuizQuestions([
      { question: "", options: ["A", "B"], correctAnswer: "A" },
      { question: null, options: ["A", "B"], correctAnswer: "A" },
    ]);
    expect(r).toEqual([]);
  });

  it("correctAnswer vazia/não-string → descartada", () => {
    const r = validateQuizQuestions([
      { question: "P", options: ["A", "B"], correctAnswer: "" },
      { question: "P", options: ["A", "B"], correctAnswer: null },
    ]);
    expect(r).toEqual([]);
  });

  it("options com números/objetos são coeridos pra string", () => {
    const r = validateQuizQuestions([
      { question: "P?", options: [1, 2, 3], correctAnswer: "1" },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].options).toEqual(["1", "2", "3"]);
  });

  it("mistura: mantém as válidas, descarta as ruins", () => {
    const r = validateQuizQuestions([
      { question: "P1", options: ["A", "B"], correctAnswer: "A" }, // ok
      { question: "P2", options: [], correctAnswer: "A" }, // options < 2
      null, // não-obj
      { question: "P3", options: ["X", "Y", "Z"], correctAnswer: "X" }, // ok
    ]);
    expect(r.map((q) => q.question)).toEqual(["P1", "P3"]);
  });
});
