import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn() }));
vi.mock("./email", () => ({ sendCompletedTaskEmail: vi.fn() }));
vi.mock("./db", () => ({
  getUserPreferences: vi.fn(),
  getUserMemoriesByUserId: vi.fn(),
  updateTask: vi.fn(),
  getIntegrationSettings: vi.fn(),
  getUserById: vi.fn(),
}));

import { completeAndEmailTask, generateCompletion } from "./autoComplete";
import * as db from "./db";
import { invokeLLM } from "./_core/llm";
import { sendCompletedTaskEmail } from "./email";

const task = { id: 3, title: "Redação sobre a Amazônia", subject: "Português" };

function llmReturns(text: string) {
  (invokeLLM as any).mockResolvedValue({ choices: [{ message: { content: text } }] });
}

beforeEach(() => {
  vi.clearAllMocks();
  (db.getUserPreferences as any).mockResolvedValue(null);
  (db.getUserMemoriesByUserId as any).mockResolvedValue([]);
});

describe("generateCompletion", () => {
  it("retorna o texto do LLM", async () => {
    llmReturns("Minha redação pronta.");
    const out = await generateCompletion(7, task);
    expect(out).toBe("Minha redação pronta.");
  });

  it("inclui as memórias como amostra de estilo no prompt", async () => {
    (db.getUserMemoriesByUserId as any).mockResolvedValue([{ title: "Meu estilo", content: "escrevo assim ó" }]);
    llmReturns("ok");
    await generateCompletion(7, task);
    const messages = (invokeLLM as any).mock.calls[0][0].messages;
    const systemMsg = messages.find((m: any) => m.role === "system").content;
    expect(systemMsg).toContain("escrevo assim ó");
  });
});

describe("completeAndEmailTask", () => {
  it("completa e envia por e-mail quando há Gmail", async () => {
    llmReturns("Trabalho feito no meu estilo.");
    (db.getIntegrationSettings as any).mockResolvedValue({ gmailUser: "eu@gmail.com", gmailAppPassword: "senha" });
    (db.getUserById as any).mockResolvedValue({ email: "eu@gmail.com" });
    const r = await completeAndEmailTask(7, task);
    expect(r).toEqual({ completed: true, emailed: true });
    expect(db.updateTask).toHaveBeenCalledWith(3, 7, expect.objectContaining({ completedContent: "Trabalho feito no meu estilo." }));
    expect(sendCompletedTaskEmail).toHaveBeenCalledTimes(1);
  });

  it("completa mas NÃO envia quando falta Gmail", async () => {
    llmReturns("Texto pronto.");
    (db.getIntegrationSettings as any).mockResolvedValue({});
    (db.getUserById as any).mockResolvedValue({ email: "eu@x.com" });
    const r = await completeAndEmailTask(7, task);
    expect(r).toEqual({ completed: true, emailed: false });
    expect(db.updateTask).toHaveBeenCalled();
    expect(sendCompletedTaskEmail).not.toHaveBeenCalled();
  });

  it("LLM vazio → não completa nem envia", async () => {
    llmReturns("   ");
    const r = await completeAndEmailTask(7, task);
    expect(r).toEqual({ completed: false, emailed: false });
    expect(db.updateTask).not.toHaveBeenCalled();
  });

  it("erro no LLM não vaza (nunca lança)", async () => {
    (invokeLLM as any).mockRejectedValue(new Error("llm down"));
    const r = await completeAndEmailTask(7, task);
    expect(r).toEqual({ completed: false, emailed: false });
  });
});
