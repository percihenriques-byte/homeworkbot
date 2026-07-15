import { describe, expect, it } from "vitest";
import { filterTasks } from "./filterTasks";

const TASKS = [
  { id: 1, status: "pendente", title: "Prova de Matemática", subject: "Matemática" },
  { id: 2, status: "concluída", title: "Redação Independência", subject: "História" },
  { id: 3, status: "pendente", title: "Exercícios de Física", description: "capítulo 5" },
  { id: 4, status: "concluida", title: "Leitura Camões" }, // sem acento
];

describe("filterTasks", () => {
  it("filter='todas' → todas as tarefas", () => {
    expect(filterTasks(TASKS, "todas")).toHaveLength(4);
  });

  it("filter='pendentes' → só pendentes", () => {
    const r = filterTasks(TASKS, "pendentes");
    expect(r.map((t) => t.id)).toEqual([1, 3]);
  });

  it("filter='concluidas' → só concluídas (com e sem acento)", () => {
    const r = filterTasks(TASKS, "concluidas");
    expect(r.map((t) => t.id).sort()).toEqual([2, 4]);
  });

  it("busca vazia não filtra", () => {
    expect(filterTasks(TASKS, "todas", "")).toHaveLength(4);
    expect(filterTasks(TASKS, "todas", "   ")).toHaveLength(4);
  });

  it("busca no título", () => {
    const r = filterTasks(TASKS, "todas", "prova");
    expect(r.map((t) => t.id)).toEqual([1]);
  });

  it("busca na descrição", () => {
    const r = filterTasks(TASKS, "todas", "capítulo 5");
    expect(r.map((t) => t.id)).toEqual([3]);
  });

  it("busca em subject", () => {
    const r = filterTasks(TASKS, "todas", "história");
    expect(r.map((t) => t.id)).toEqual([2]);
  });

  it("busca é case-insensitive", () => {
    expect(filterTasks(TASKS, "todas", "PROVA")).toHaveLength(1);
    expect(filterTasks(TASKS, "todas", "prova")).toHaveLength(1);
    expect(filterTasks(TASKS, "todas", "Prova")).toHaveLength(1);
  });

  it("busca é acento-insensitive", () => {
    // "matematica" (sem acento) casa com "Matemática" (com acento)
    expect(filterTasks(TASKS, "todas", "matematica")).toHaveLength(1);
    // e vice-versa
    expect(filterTasks(TASKS, "todas", "história")).toHaveLength(1);
  });

  it("combina filter + search", () => {
    // Só pendentes que contenham "física"
    const r = filterTasks(TASKS, "pendentes", "física");
    expect(r.map((t) => t.id)).toEqual([3]);
    // "redação" só existe em uma concluída — busca em pendentes retorna vazio
    expect(filterTasks(TASKS, "pendentes", "redação")).toHaveLength(0);
  });

  it("substring parcial casa", () => {
    // "mat" casa com "Matemática"
    expect(filterTasks(TASKS, "todas", "mat")).toHaveLength(1);
  });

  it("busca inexistente → vazio", () => {
    expect(filterTasks(TASKS, "todas", "xyz-inexistente")).toHaveLength(0);
  });

  it("array vazio → vazio pra qualquer filtro", () => {
    expect(filterTasks([], "todas")).toEqual([]);
    expect(filterTasks([], "pendentes", "x")).toEqual([]);
  });

  it("não muta o array de entrada", () => {
    const copy = JSON.parse(JSON.stringify(TASKS));
    filterTasks(TASKS, "pendentes", "prova");
    expect(TASKS).toEqual(copy);
  });
});
