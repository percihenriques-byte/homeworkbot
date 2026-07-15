import { describe, expect, it } from "vitest";
import { isDueSoon, isOverdue, taskUrgency } from "./taskUrgency";

// Referência fixa: 2026-07-15 12:00:00 local.
const NOW = new Date(2026, 6, 15, 12, 0, 0);
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000);
const hoursAhead = (h: number) => new Date(NOW.getTime() + h * 3600_000);

describe("taskUrgency", () => {
  it('"done" quando status concluída (mesmo com prazo atrasado)', () => {
    expect(taskUrgency({ status: "concluída", dueDate: hoursAgo(48) }, NOW)).toBe("done");
    // Normalizado: aceita sem acento também.
    expect(taskUrgency({ status: "concluida" }, NOW)).toBe("done");
  });

  it('"overdue" quando pendente + prazo no passado', () => {
    expect(taskUrgency({ status: "pendente", dueDate: hoursAgo(1) }, NOW)).toBe("overdue");
    expect(taskUrgency({ dueDate: hoursAgo(48) }, NOW)).toBe("overdue");
  });

  it('"due-soon" quando pendente + prazo dentro das próximas 24h', () => {
    expect(taskUrgency({ dueDate: hoursAhead(1) }, NOW)).toBe("due-soon");
    expect(taskUrgency({ dueDate: hoursAhead(23) }, NOW)).toBe("due-soon");
  });

  it('"future" quando pendente + prazo > 24h no futuro', () => {
    expect(taskUrgency({ dueDate: hoursAhead(48) }, NOW)).toBe("future");
    expect(taskUrgency({ dueDate: hoursAhead(24 * 30) }, NOW)).toBe("future");
  });

  it('"no-date" quando pendente sem prazo', () => {
    expect(taskUrgency({}, NOW)).toBe("no-date");
    expect(taskUrgency({ dueDate: null }, NOW)).toBe("no-date");
    expect(taskUrgency({ dueDate: undefined }, NOW)).toBe("no-date");
  });

  it('"no-date" quando dueDate é string inválida', () => {
    expect(taskUrgency({ dueDate: "bogus" }, NOW)).toBe("no-date");
  });

  it("aceita dueDate como string ISO", () => {
    expect(
      taskUrgency({ dueDate: hoursAhead(2).toISOString() }, NOW)
    ).toBe("due-soon");
  });

  it("fronteira exata: prazo == agora → overdue (< nowMs falha, mas <= nowMs+24h passa)", () => {
    // dueMs < nowMs → overdue. Aqui dueMs == nowMs → NÃO é overdue,
    // cai em due-soon (dueMs < nowMs + 24h).
    expect(taskUrgency({ dueDate: NOW }, NOW)).toBe("due-soon");
  });

  it("fronteira 24h: exatamente +24h vira future (não due-soon)", () => {
    // dueMs < nowMs + 24h → due-soon. Igual não passa (< estrito).
    expect(taskUrgency({ dueDate: hoursAhead(24) }, NOW)).toBe("future");
  });
});

describe("isOverdue / isDueSoon", () => {
  it("isOverdue combina", () => {
    expect(isOverdue({ dueDate: hoursAgo(1) }, NOW)).toBe(true);
    expect(isOverdue({ dueDate: hoursAhead(1) }, NOW)).toBe(false);
    expect(isOverdue({ status: "concluída", dueDate: hoursAgo(1) }, NOW)).toBe(false);
  });

  it("isDueSoon combina", () => {
    expect(isDueSoon({ dueDate: hoursAhead(2) }, NOW)).toBe(true);
    expect(isDueSoon({ dueDate: hoursAhead(48) }, NOW)).toBe(false);
    expect(isDueSoon({ dueDate: hoursAgo(1) }, NOW)).toBe(false);
  });
});
