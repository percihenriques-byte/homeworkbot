import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocka as dependências com I/O — testamos só a lógica das ferramentas.
vi.mock("./llm", () => ({ invokeLLM: vi.fn() }));
vi.mock("./reminders", () => ({ syncTaskReminder: vi.fn() }));
vi.mock("./db", () => ({
  createTask: vi.fn(),
  getTaskById: vi.fn(),
  getTasksByUserId: vi.fn(),
  updateTask: vi.fn(),
  deleteUnsentRemindersForTask: vi.fn(),
  createFlashcard: vi.fn(),
  createQuiz: vi.fn(),
  createStudyGuide: vi.fn(),
  createStudySchedule: vi.fn(),
  getUserPreferences: vi.fn(),
  getUserMemoriesByUserId: vi.fn(),
}));

import { executeAgentTool } from "./agentTools";
import * as db from "./db";

beforeEach(() => vi.clearAllMocks());

describe("executeAgentTool", () => {
  it("criar_tarefa: cria com enums válidos, descarta enum inválido e agenda lembrete", async () => {
    (db.createTask as any).mockResolvedValue({ id: 1, title: "Prova de Mat" });
    const r = await executeAgentTool(
      "criar_tarefa",
      { title: "Prova de Mat", subject: "Matemática", priority: "alta", difficulty: "inexistente", dueDate: "2026-07-18" },
      42
    );
    expect(r.ok).toBe(true);
    const arg = (db.createTask as any).mock.calls[0][0];
    expect(arg.userId).toBe(42);
    expect(arg.title).toBe("Prova de Mat");
    expect(arg.priority).toBe("alta");
    expect(arg.difficulty).toBeUndefined(); // "inexistente" não é enum válido
    expect(arg.dueDate).toBeInstanceOf(Date);
  });

  it("criar_tarefa: sem título → erro, não chama o banco", async () => {
    const r = await executeAgentTool("criar_tarefa", { title: "  " }, 42);
    expect(r.ok).toBe(false);
    expect(db.createTask).not.toHaveBeenCalled();
  });

  it("marcar_tarefa_concluida: casa por título ignorando acento/caixa", async () => {
    (db.getTasksByUserId as any).mockResolvedValue([
      { id: 5, title: "Prova de História", status: "pendente" },
      { id: 6, title: "Redação", status: "pendente" },
    ]);
    const r = await executeAgentTool("marcar_tarefa_concluida", { titulo: "prova de historia" }, 42);
    expect(r.ok).toBe(true);
    expect((db.updateTask as any).mock.calls[0][0]).toBe(5);
    expect((db.updateTask as any).mock.calls[0][2].status).toBe("concluída");
    expect(db.deleteUnsentRemindersForTask).toHaveBeenCalledWith(42, 5);
  });

  it("marcar_tarefa_concluida: não encontrada → ok:false", async () => {
    (db.getTasksByUserId as any).mockResolvedValue([{ id: 5, title: "Prova", status: "pendente" }]);
    const r = await executeAgentTool("marcar_tarefa_concluida", { titulo: "geografia" }, 42);
    expect(r.ok).toBe(false);
    expect(db.updateTask).not.toHaveBeenCalled();
  });

  it("marcar_tarefa_concluida: não casa tarefa já concluída", async () => {
    (db.getTasksByUserId as any).mockResolvedValue([{ id: 5, title: "Prova", status: "concluída" }]);
    const r = await executeAgentTool("marcar_tarefa_concluida", { titulo: "prova" }, 42);
    expect(r.ok).toBe(false);
  });

  it("listar_tarefas: só pendentes, formatado", async () => {
    (db.getTasksByUserId as any).mockResolvedValue([
      { id: 1, title: "Lição A", status: "pendente", subject: "Mat" },
      { id: 2, title: "Feita B", status: "concluída" },
    ]);
    const r = await executeAgentTool("listar_tarefas", {}, 42);
    expect(r.ok).toBe(true);
    expect(r.summary).toContain("Lição A (Mat)");
    expect(r.summary).not.toContain("Feita B");
  });

  it("ferramenta desconhecida → ok:false", async () => {
    const r = await executeAgentTool("ferramenta_que_nao_existe", {}, 42);
    expect(r.ok).toBe(false);
  });

  it("erro no banco não vaza — retorna ok:false (nunca lança)", async () => {
    (db.getTasksByUserId as any).mockRejectedValue(new Error("db down"));
    const r = await executeAgentTool("listar_tarefas", {}, 42);
    expect(r.ok).toBe(false);
    expect(r.summary).toContain("Erro");
  });
});
