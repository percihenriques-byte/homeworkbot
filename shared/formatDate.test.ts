import { describe, expect, it } from "vitest";
import { formatDate } from "./formatDate";

const NOW = new Date(2026, 6, 15, 12, 0, 0); // 15/jul/2026 12:00 local

describe("formatDate (formato pt-BR)", () => {
  it("Date → dd/mm/aaaa", () => {
    expect(formatDate(new Date(2026, 6, 20))).toBe("20/07/2026");
  });

  it("string ISO → pt-BR", () => {
    // Só verifica que retorna algo formatado (o fuso pode mudar o dia,
    // então evitamos assertar valor exato aqui).
    const r = formatDate("2026-07-20T12:00:00Z");
    expect(r).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  it("timestamp (number) → pt-BR", () => {
    const r = formatDate(new Date(2026, 6, 20).getTime());
    expect(r).toBe("20/07/2026");
  });

  it("null / undefined → string vazia (nunca 'null' ou 'undefined')", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDate(undefined)).toBe("");
  });

  it("string inválida → string vazia (nunca NaN)", () => {
    expect(formatDate("nao-e-data")).toBe("");
    expect(formatDate("")).toBe("");
  });
});

describe("formatDate (relative)", () => {
  it("hoje → 'hoje'", () => {
    expect(formatDate(new Date(2026, 6, 15, 8, 0), { now: NOW, relative: true })).toBe("hoje");
    expect(formatDate(new Date(2026, 6, 15, 23, 59), { now: NOW, relative: true })).toBe("hoje");
  });

  it("amanhã → 'amanhã'", () => {
    expect(formatDate(new Date(2026, 6, 16, 8, 0), { now: NOW, relative: true })).toBe("amanhã");
  });

  it("ontem → 'ontem'", () => {
    expect(formatDate(new Date(2026, 6, 14, 8, 0), { now: NOW, relative: true })).toBe("ontem");
  });

  it("em 3 dias", () => {
    expect(formatDate(new Date(2026, 6, 18), { now: NOW, relative: true })).toBe("em 3 dias");
  });

  it("3 dias atrás", () => {
    expect(formatDate(new Date(2026, 6, 12), { now: NOW, relative: true })).toBe("3 dias atrás");
  });

  it("em 7 dias (borda) ainda é relativo", () => {
    expect(formatDate(new Date(2026, 6, 22), { now: NOW, relative: true })).toBe("em 7 dias");
  });

  it("em 8 dias (fora da janela) → cai no formato pt-BR", () => {
    expect(formatDate(new Date(2026, 6, 23), { now: NOW, relative: true })).toBe("23/07/2026");
  });

  it("8 dias atrás → cai no pt-BR", () => {
    expect(formatDate(new Date(2026, 6, 7), { now: NOW, relative: true })).toBe("07/07/2026");
  });

  it("relative não muda o comportamento pra null/inválido", () => {
    expect(formatDate(null, { now: NOW, relative: true })).toBe("");
    expect(formatDate("x", { now: NOW, relative: true })).toBe("");
  });

  it("relative=false (default) sempre usa pt-BR mesmo pra hoje", () => {
    expect(formatDate(new Date(2026, 6, 15, 8), { now: NOW })).toBe("15/07/2026");
  });

  it("diferença de horas dentro do mesmo dia = 'hoje' (não em 1 dia)", () => {
    // 23h de diferença cruzando meia-noite deveria ser 'amanhã'/'ontem',
    // não 'em 1 dia' — usamos start-of-day.
    expect(formatDate(new Date(2026, 6, 15, 23, 0), { now: new Date(2026, 6, 15, 0, 0), relative: true })).toBe("hoje");
  });
});
