import { describe, expect, it } from "vitest";
import { taskDedupKey } from "./taskDedupKey";

describe("taskDedupKey", () => {
  it("mesma tarefa (título + dia) → mesma key", () => {
    const a = taskDedupKey("Prova de Mat", new Date("2026-07-20T09:00:00Z"));
    const b = taskDedupKey("Prova de Mat", new Date("2026-07-20T15:00:00Z"));
    // Mesma data ISO (20) — horas diferentes mas mesmo dia UTC.
    expect(a).toBe(b);
  });

  it("dias diferentes → keys diferentes", () => {
    const a = taskDedupKey("Prova", new Date("2026-07-20T00:00:00Z"));
    const b = taskDedupKey("Prova", new Date("2026-07-21T00:00:00Z"));
    expect(a).not.toBe(b);
  });

  it("títulos diferentes → keys diferentes", () => {
    const d = new Date("2026-07-20");
    expect(taskDedupKey("A", d)).not.toBe(taskDedupKey("B", d));
  });

  it("título com espaços/caixa diferente casa (trim + toLowerCase)", () => {
    const d = new Date("2026-07-20");
    expect(taskDedupKey("  PROVA de Mat  ", d)).toBe(taskDedupKey("prova de mat", d));
  });

  it("sem prazo (null) → key com dia vazio", () => {
    const key = taskDedupKey("Ler capítulo", null);
    expect(key.endsWith("|")).toBe(true);
  });

  it("undefined title → só o separador+dia", () => {
    expect(taskDedupKey(undefined, new Date("2026-07-20"))).toBe("|2026-07-20");
  });

  it("string ISO em due também funciona", () => {
    const a = taskDedupKey("X", "2026-07-20T00:00:00Z");
    const b = taskDedupKey("X", new Date("2026-07-20T00:00:00Z"));
    expect(a).toBe(b);
  });

  it("data inválida vira dia vazio (não NaN nem crash)", () => {
    const k = taskDedupKey("X", "nao-e-data");
    expect(k).toBe("x|");
  });

  it("acentos preservados (o dedup é case-insensitive mas NÃO accent-insensitive)", () => {
    // Contrato atual: 'Matemática' ≠ 'Matematica' — dedup só bate quando
    // as duas pontas vieram com a mesma grafia. Aceitável porque quem
    // deduplica são cópias do mesmo evento .ics.
    const d = new Date("2026-07-20");
    expect(taskDedupKey("Matemática", d)).not.toBe(taskDedupKey("Matematica", d));
  });

  it("é determinístico", () => {
    const d = new Date("2026-07-20T12:00:00Z");
    expect(taskDedupKey("Prova", d)).toBe(taskDedupKey("Prova", d));
  });
});
