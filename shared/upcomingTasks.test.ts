import { describe, expect, it } from "vitest";
import { getUpcomingTasks } from "./upcomingTasks";

const NOW = new Date(2026, 6, 15, 12, 0, 0);
const daysAhead = (n: number) => new Date(NOW.getTime() + n * 24 * 3600 * 1000);
const hoursAhead = (h: number) => new Date(NOW.getTime() + h * 3600 * 1000);
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600 * 1000);

describe("getUpcomingTasks", () => {
  it("vazio → []", () => {
    expect(getUpcomingTasks([], { now: NOW })).toEqual([]);
  });

  it("filtra concluídas", () => {
    const r = getUpcomingTasks(
      [
        { status: "concluída", dueDate: hoursAhead(1) },
        { status: "pendente", dueDate: hoursAhead(1) },
      ],
      { now: NOW }
    );
    expect(r).toHaveLength(1);
    expect(r[0].status).toBe("pendente");
  });

  it("normaliza acentos em concluida", () => {
    const r = getUpcomingTasks(
      [{ status: "concluida", dueDate: hoursAhead(1) }],
      { now: NOW }
    );
    expect(r).toHaveLength(0);
  });

  it("exclui tarefas sem dueDate", () => {
    const r = getUpcomingTasks([{ status: "pendente" }], { now: NOW });
    expect(r).toHaveLength(0);
  });

  it("exclui tarefas atrasadas (dueDate no passado)", () => {
    const r = getUpcomingTasks(
      [{ status: "pendente", dueDate: hoursAgo(1) }],
      { now: NOW }
    );
    expect(r).toHaveLength(0);
  });

  it("exclui tarefas além da janela (> 7d)", () => {
    const r = getUpcomingTasks(
      [
        { status: "pendente", dueDate: hoursAhead(1) },
        { status: "pendente", dueDate: daysAhead(10) },
      ],
      { now: NOW }
    );
    expect(r).toHaveLength(1);
  });

  it("aceita janela customizada (daysAhead)", () => {
    const r = getUpcomingTasks(
      [{ status: "pendente", dueDate: daysAhead(10) }],
      { now: NOW, daysAhead: 14 }
    );
    expect(r).toHaveLength(1);
  });

  it("ordena por dueDate crescente", () => {
    const r = getUpcomingTasks(
      [
        { id: 3, status: "pendente", dueDate: daysAhead(3) },
        { id: 1, status: "pendente", dueDate: daysAhead(1) },
        { id: 2, status: "pendente", dueDate: daysAhead(2) },
      ] as any,
      { now: NOW }
    );
    expect((r as any).map((t: any) => t.id)).toEqual([1, 2, 3]);
  });

  it("corta em limit (default 5)", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      status: "pendente",
      dueDate: daysAhead(i / 2),
    }));
    expect(getUpcomingTasks(many, { now: NOW })).toHaveLength(5);
  });

  it("respeita limit customizado", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      status: "pendente",
      dueDate: daysAhead(i / 2),
    }));
    expect(getUpcomingTasks(many, { now: NOW, limit: 3 })).toHaveLength(3);
  });

  it("dueDate inválida (NaN) é filtrada", () => {
    const r = getUpcomingTasks(
      [
        { status: "pendente", dueDate: "nao-e-data" as any },
        { status: "pendente", dueDate: hoursAhead(1) },
      ],
      { now: NOW }
    );
    expect(r).toHaveLength(1);
  });

  it("string ISO em dueDate funciona", () => {
    const iso = hoursAhead(2).toISOString();
    const r = getUpcomingTasks(
      [{ status: "pendente", dueDate: iso }],
      { now: NOW }
    );
    expect(r).toHaveLength(1);
  });

  it("não muta o array de entrada", () => {
    const input = [
      { status: "pendente", dueDate: daysAhead(3) },
      { status: "pendente", dueDate: daysAhead(1) },
    ];
    const copy = JSON.parse(JSON.stringify(input));
    getUpcomingTasks(input, { now: NOW });
    expect(input).toEqual(copy);
  });

  it("dueDate == now → incluído (borda inferior fechada)", () => {
    const r = getUpcomingTasks(
      [{ status: "pendente", dueDate: NOW }],
      { now: NOW }
    );
    expect(r).toHaveLength(1);
  });
});
