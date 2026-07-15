import { describe, expect, it } from "vitest";
import { computeQuizScore } from "./quizScore";

const Qs = [
  { correctAnswer: "A" },
  { correctAnswer: "B" },
  { correctAnswer: "C" },
  { correctAnswer: "D" },
  { correctAnswer: "E" },
];

describe("computeQuizScore", () => {
  it("0 questões → tudo zero + badge 'estudar mais'", () => {
    expect(computeQuizScore([], {})).toEqual({
      total: 0,
      score: 0,
      pct: 0,
      badge: "📚",
    });
  });

  it("100% acerto → 🏆", () => {
    const r = computeQuizScore(Qs, { 0: "A", 1: "B", 2: "C", 3: "D", 4: "E" });
    expect(r).toEqual({ total: 5, score: 5, pct: 100, badge: "🏆" });
  });

  it("80% acerto → 🏆 (borda inclusiva)", () => {
    const r = computeQuizScore(Qs, { 0: "A", 1: "B", 2: "C", 3: "D", 4: "X" });
    expect(r.pct).toBe(80);
    expect(r.badge).toBe("🏆");
  });

  it("60% → 👍", () => {
    const r = computeQuizScore(Qs, { 0: "A", 1: "B", 2: "C", 3: "X", 4: "X" });
    expect(r.pct).toBe(60);
    expect(r.badge).toBe("👍");
  });

  it("59% → 📚 (borda exclusiva)", () => {
    const q7 = Array.from({ length: 7 }, (_, i) => ({ correctAnswer: `A${i}` }));
    // 4/7 = 57% (< 60)
    const r = computeQuizScore(q7, { 0: "A0", 1: "A1", 2: "A2", 3: "A3" });
    expect(r.score).toBe(4);
    expect(r.badge).toBe("📚");
  });

  it("questão pulada NÃO conta como acerto", () => {
    const r = computeQuizScore(Qs, { 0: "A", 1: "B" }); // 3 puladas
    expect(r.score).toBe(2);
    expect(r.total).toBe(5);
    expect(r.pct).toBe(40);
  });

  it("resposta null/undefined/vazia não crasha", () => {
    const r = computeQuizScore(Qs, {
      0: "A",
      1: null,
      2: undefined,
      3: "",
      4: "E",
    });
    expect(r.score).toBe(2);
  });

  it("resposta case-sensitive (pra caso o LLM inserir opções distintas)", () => {
    const r = computeQuizScore([{ correctAnswer: "Sim" }], { 0: "sim" });
    expect(r.score).toBe(0);
  });

  it("pct arredonda pra inteiro mais próximo", () => {
    const q3 = [{ correctAnswer: "A" }, { correctAnswer: "B" }, { correctAnswer: "C" }];
    // 1/3 = 33.33...% → 33
    const r = computeQuizScore(q3, { 0: "A" });
    expect(r.pct).toBe(33);
  });

  it("determinístico com mesmo input", () => {
    const a = computeQuizScore(Qs, { 0: "A", 1: "B" });
    const b = computeQuizScore(Qs, { 0: "A", 1: "B" });
    expect(a).toEqual(b);
  });
});
