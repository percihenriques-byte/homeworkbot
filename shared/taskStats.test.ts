import { describe, expect, it } from "vitest";
import { computeTaskStats } from "./taskStats";

const NOW = new Date(2026, 6, 15, 12, 0, 0);
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000);
const hoursAhead = (h: number) => new Date(NOW.getTime() + h * 3600_000);

describe("computeTaskStats", () => {
  it("array vazio → zeros", () => {
    expect(computeTaskStats([], NOW)).toEqual({
      total: 0,
      done: 0,
      pending: 0,
      overdue: 0,
      dueSoon: 0,
      pct: 0,
    });
  });

  it("mistura variada de urgências", () => {
    const tasks = [
      { status: "concluída" }, // done
      { status: "pendente", dueDate: hoursAgo(1) }, // overdue
      { status: "pendente", dueDate: hoursAhead(1) }, // due-soon
      { status: "pendente", dueDate: hoursAhead(48) }, // future
      { status: "pendente" }, // no-date
      { status: "concluída", dueDate: hoursAgo(10) }, // done (não conta overdue)
    ];
    const s = computeTaskStats(tasks, NOW);
    expect(s.total).toBe(6);
    expect(s.done).toBe(2);
    expect(s.pending).toBe(4);
    expect(s.overdue).toBe(1);
    expect(s.dueSoon).toBe(1);
  });

  it("pct arredonda pra inteiro mais próximo", () => {
    // 1 done de 3 = 33.33...% → 33
    const s = computeTaskStats(
      [{ status: "concluída" }, { status: "pendente" }, { status: "pendente" }],
      NOW
    );
    expect(s.pct).toBe(33);
  });

  it("pct = 100 quando tudo concluído", () => {
    const s = computeTaskStats([{ status: "concluída" }, { status: "concluída" }], NOW);
    expect(s.pct).toBe(100);
  });

  it("pct = 0 quando nada concluído", () => {
    const s = computeTaskStats([{ status: "pendente" }, { status: "pendente" }], NOW);
    expect(s.pct).toBe(0);
  });

  it("done + pending = total", () => {
    const s = computeTaskStats(
      [
        { status: "pendente" },
        { status: "concluída" },
        { status: "concluída" },
        { status: "em_progresso" },
      ],
      NOW
    );
    expect(s.done + s.pending).toBe(s.total);
    expect(s.done).toBe(2);
    expect(s.pending).toBe(2);
  });

  it("normaliza acentos no status (concluída vs concluida)", () => {
    const s = computeTaskStats(
      [{ status: "concluida" }, { status: "concluída" }],
      NOW
    );
    expect(s.done).toBe(2);
  });
});
