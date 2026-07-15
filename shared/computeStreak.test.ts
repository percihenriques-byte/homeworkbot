import { describe, expect, it } from "vitest";
import { computeStreak } from "./computeStreak";

// Fixa "hoje" pra testes determinísticos: 2026-07-15 12:00 (meio-dia
// pra evitar edge case de virada de dia).
const HOJE = new Date(2026, 6, 15, 12, 0, 0); // mês zero-indexed → 6 = julho

function day(offsetDays: number): Date {
  const d = new Date(HOJE);
  d.setDate(d.getDate() + offsetDays);
  return d;
}

describe("computeStreak", () => {
  it("zero quando não há atividades", () => {
    expect(computeStreak([], HOJE)).toBe(0);
  });

  it("zero quando hoje não tem atividade (streak exige dia atual)", () => {
    expect(computeStreak([day(-1), day(-2)], HOJE)).toBe(0);
  });

  it("1 quando só hoje tem atividade", () => {
    expect(computeStreak([day(0)], HOJE)).toBe(1);
  });

  it("3 quando hoje, ontem e anteontem tem atividade", () => {
    expect(computeStreak([day(0), day(-1), day(-2)], HOJE)).toBe(3);
  });

  it("para no primeiro buraco (não pula dias)", () => {
    // hoje, ontem, anteontem faltando, depois anteontem-2 tem — só conta 2.
    expect(computeStreak([day(0), day(-1), day(-3)], HOJE)).toBe(2);
  });

  it("múltiplas atividades no mesmo dia contam como 1", () => {
    // hoje 3 vezes + ontem 2 vezes = streak 2, não 5.
    expect(
      computeStreak([day(0), day(0), day(0), day(-1), day(-1)], HOJE)
    ).toBe(2);
  });

  it("ignora null / undefined / inválido", () => {
    expect(
      computeStreak([null, undefined, "bogus", NaN, day(0)], HOJE)
    ).toBe(1);
  });

  it("aceita string ISO e timestamp", () => {
    expect(
      computeStreak([day(0).toISOString(), day(-1).getTime()], HOJE)
    ).toBe(2);
  });

  it("aceita horas diferentes no mesmo dia local", () => {
    // manhã de hoje + noite de hoje = 1 dia, streak 1
    const manha = new Date(HOJE);
    manha.setHours(6, 30, 0, 0);
    const noite = new Date(HOJE);
    noite.setHours(22, 45, 0, 0);
    expect(computeStreak([manha, noite], HOJE)).toBe(1);
  });

  it("cap em 365 dias", () => {
    // Cria 400 dias consecutivos — o cap deve limitar em 365.
    const dias = Array.from({ length: 400 }, (_, i) => day(-i));
    expect(computeStreak(dias, HOJE)).toBe(365);
  });

  it("ignora datas futuras (não fura pra frente)", () => {
    // Só amanhã e depois-de-amanhã — hoje sem atividade → 0.
    expect(computeStreak([day(1), day(2)], HOJE)).toBe(0);
  });
});
