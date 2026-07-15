import { describe, expect, it } from "vitest";
import { isPendingTask } from "./isPendingTask";

describe("isPendingTask", () => {
  it("status pendente sem completedAt → true", () => {
    expect(isPendingTask({ status: "pendente" })).toBe(true);
  });

  it("status concluída (com acento) → false", () => {
    expect(isPendingTask({ status: "concluída" })).toBe(false);
  });

  it("status concluida (sem acento) → false (normalize equalize)", () => {
    expect(isPendingTask({ status: "concluida" })).toBe(false);
  });

  it("status CONCLUÍDA (maiúsculo) → false", () => {
    expect(isPendingTask({ status: "CONCLUÍDA" })).toBe(false);
  });

  it("completedAt preenchido → false mesmo com status pendente", () => {
    // Caso de dado inconsistente: safety net garante que não retorne
    // como pendente algo que já tem completedAt.
    expect(isPendingTask({ status: "pendente", completedAt: new Date() })).toBe(false);
  });

  it("completedAt como string ISO também bloqueia", () => {
    expect(isPendingTask({ status: "pendente", completedAt: "2026-07-15" })).toBe(false);
  });

  it("status em progresso é pendente (falta terminar)", () => {
    expect(isPendingTask({ status: "em_progresso" })).toBe(true);
  });

  it("sem status nem completedAt → pendente (default seguro)", () => {
    expect(isPendingTask({})).toBe(true);
  });

  it("null / undefined nos campos não crasha", () => {
    expect(isPendingTask({ status: null, completedAt: null })).toBe(true);
    expect(isPendingTask({ status: undefined, completedAt: undefined })).toBe(true);
  });
});
