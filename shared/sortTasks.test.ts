import { describe, expect, it } from "vitest";
import { compareTasks, sortTasks } from "./sortTasks";

const t = (opts: Partial<{
  id: number;
  title: string;
  status: string;
  priority: string;
  dueDate: Date | string | null;
}>) => ({
  id: opts.id ?? 0,
  title: opts.title ?? "t",
  status: opts.status ?? "pendente",
  priority: opts.priority ?? "média",
  dueDate: opts.dueDate ?? null,
});

describe("compareTasks / sortTasks", () => {
  it("concluídas vão para o fim", () => {
    const a = t({ id: 1, status: "concluída" });
    const b = t({ id: 2, status: "pendente" });
    expect(compareTasks(a, b)).toBeGreaterThan(0); // b antes de a
    const sorted = sortTasks([a, b]);
    expect(sorted.map((x) => x.id)).toEqual([2, 1]);
  });

  it("dentro do mesmo status, alta prioridade primeiro", () => {
    const sorted = sortTasks([
      t({ id: 1, priority: "baixa" }),
      t({ id: 2, priority: "alta" }),
      t({ id: 3, priority: "média" }),
    ]);
    expect(sorted.map((x) => x.id)).toEqual([2, 3, 1]);
  });

  it("prioridade normalizada aceita variações de caixa e acento", () => {
    const sorted = sortTasks([
      t({ id: 1, priority: "MÉDIA" }),
      t({ id: 2, priority: "alta" }),
      t({ id: 3, priority: "Baixa" }),
    ]);
    expect(sorted.map((x) => x.id)).toEqual([2, 1, 3]);
  });

  it("mesma prioridade → data mais próxima primeiro", () => {
    const sorted = sortTasks([
      t({ id: 1, priority: "alta", dueDate: new Date(2026, 6, 20) }),
      t({ id: 2, priority: "alta", dueDate: new Date(2026, 6, 10) }),
      t({ id: 3, priority: "alta", dueDate: new Date(2026, 6, 15) }),
    ]);
    expect(sorted.map((x) => x.id)).toEqual([2, 3, 1]);
  });

  it("tarefas sem prazo vão pro fim do bloco", () => {
    const sorted = sortTasks([
      t({ id: 1, priority: "alta", dueDate: null }),
      t({ id: 2, priority: "alta", dueDate: new Date(2026, 6, 10) }),
    ]);
    expect(sorted.map((x) => x.id)).toEqual([2, 1]);
  });

  it("prioridade desconhecida vai depois das conhecidas", () => {
    const sorted = sortTasks([
      t({ id: 1, priority: "xyz" }),
      t({ id: 2, priority: "baixa" }),
      t({ id: 3, priority: "alta" }),
    ]);
    expect(sorted.map((x) => x.id)).toEqual([3, 2, 1]);
  });

  it("sort é estável em relação ao array de entrada (não muta)", () => {
    const input = [
      t({ id: 1, priority: "baixa" }),
      t({ id: 2, priority: "alta" }),
    ];
    const copy = [...input];
    sortTasks(input);
    expect(input).toEqual(copy);
  });

  it("cenário composto: mistura de status + prioridade + prazo", () => {
    const sorted = sortTasks([
      t({ id: 1, status: "concluída", priority: "alta" }),
      t({ id: 2, status: "pendente", priority: "baixa", dueDate: new Date(2026, 6, 10) }),
      t({ id: 3, status: "pendente", priority: "alta", dueDate: new Date(2026, 6, 20) }),
      t({ id: 4, status: "pendente", priority: "alta", dueDate: new Date(2026, 6, 15) }),
    ]);
    // 4 (alta+15), 3 (alta+20), 2 (baixa+10), 1 (concluída)
    expect(sorted.map((x) => x.id)).toEqual([4, 3, 2, 1]);
  });

  it("aceita dueDate como string ISO", () => {
    const sorted = sortTasks([
      t({ id: 1, priority: "alta", dueDate: "2026-07-20T00:00:00Z" }),
      t({ id: 2, priority: "alta", dueDate: "2026-07-10T00:00:00Z" }),
    ]);
    expect(sorted.map((x) => x.id)).toEqual([2, 1]);
  });

  it("array vazio devolve array vazio", () => {
    expect(sortTasks([])).toEqual([]);
  });

  it("dueDate inválida (NaN) trata como sem prazo — não quebra ordem", () => {
    // Sem o Number.isFinite guard, NaN nas comparações deixaria o sort
    // não-determinístico (compareFn retornando NaN é UB).
    const sorted = sortTasks([
      t({ id: 1, priority: "alta", dueDate: "nao-e-data" as any }),
      t({ id: 2, priority: "alta", dueDate: new Date(2026, 6, 10) }),
      t({ id: 3, priority: "alta", dueDate: new Date(2026, 6, 20) }),
    ]);
    // id=1 tem prazo inválido → tratado como Infinity → vai pro fim.
    expect(sorted.map((x) => x.id)).toEqual([2, 3, 1]);
  });
});
