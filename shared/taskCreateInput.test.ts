import { describe, expect, it } from "vitest";
import { taskToCreateInput } from "./taskCreateInput";

describe("taskToCreateInput", () => {
  it("tarefa mínima só com título", () => {
    expect(taskToCreateInput({ title: "Prova" })).toEqual({ title: "Prova" });
  });

  it("todos os campos preenchidos passam", () => {
    const r = taskToCreateInput({
      title: "T",
      description: "D",
      dueDate: new Date("2026-07-20"),
      difficulty: "médio",
      priority: "alta",
      type: "prova",
      subject: "Mat",
      notes: "N",
    });
    expect(r.title).toBe("T");
    expect(r.description).toBe("D");
    expect(r.dueDate).toBeInstanceOf(Date);
    expect(r.difficulty).toBe("médio");
    expect(r.priority).toBe("alta");
    expect(r.type).toBe("prova");
    expect(r.subject).toBe("Mat");
    expect(r.notes).toBe("N");
  });

  it("strings vazias viram undefined (não '')", () => {
    const r = taskToCreateInput({
      title: "T",
      description: "",
      subject: "",
      notes: "",
    });
    expect(r.description).toBeUndefined();
    expect(r.subject).toBeUndefined();
    expect(r.notes).toBeUndefined();
  });

  it("null/undefined nos campos são undefined no payload", () => {
    const r = taskToCreateInput({
      title: "T",
      description: null,
      dueDate: null,
      difficulty: undefined,
    });
    expect(r.description).toBeUndefined();
    expect(r.dueDate).toBeUndefined();
    expect(r.difficulty).toBeUndefined();
  });

  it("dueDate string ISO vira Date", () => {
    const r = taskToCreateInput({ title: "T", dueDate: "2026-07-20T10:00:00Z" });
    expect(r.dueDate).toBeInstanceOf(Date);
    expect(r.dueDate?.toISOString()).toBe("2026-07-20T10:00:00.000Z");
  });

  it("dueDate inválida (não é data) vira undefined (não NaN)", () => {
    const r = taskToCreateInput({ title: "T", dueDate: "nao-e-data" as any });
    expect(r.dueDate).toBeUndefined();
  });

  it("overrideTitle vence o title original (usado no 'Duplicar')", () => {
    const r = taskToCreateInput({ title: "Original" }, "Original (cópia)");
    expect(r.title).toBe("Original (cópia)");
  });

  it("title ausente vira string vazia (nunca undefined)", () => {
    // Zod do server exige title min 1 — o UI ainda vai rejeitar, mas o
    // util não deve crashar com undefined.
    expect(taskToCreateInput({}).title).toBe("");
  });

  it("não vaza campos extras do task de entrada", () => {
    const r = taskToCreateInput({
      title: "T",
      // @ts-expect-error — campo estranho não vai pro payload
      status: "concluída",
      // @ts-expect-error
      completedAt: new Date(),
      // @ts-expect-error
      id: 42,
    });
    expect((r as any).status).toBeUndefined();
    expect((r as any).completedAt).toBeUndefined();
    expect((r as any).id).toBeUndefined();
  });
});
