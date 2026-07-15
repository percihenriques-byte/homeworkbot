import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./llm", () => ({ invokeLLM: vi.fn() }));
vi.mock("./email", () => ({ sendCompletedTaskEmail: vi.fn() }));
vi.mock("./storage", () => ({
  // Passa a URL adiante inalterada — testes não precisam do fluxo S3.
  resolveExternalUrl: vi.fn(async (url: string) => url),
}));
vi.mock("./db", () => ({
  getUserPreferences: vi.fn(),
  getUserMemoriesByUserId: vi.fn(),
  updateTask: vi.fn(),
  getIntegrationSettings: vi.fn(),
  getUserById: vi.fn(),
}));

import { completeAndEmailTask, generateCompletion } from "./autoComplete";
import * as db from "./db";
import { invokeLLM } from "./llm";
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

  it("sem imagens → user content é string simples (compat todos providers)", async () => {
    (db.getUserMemoriesByUserId as any).mockResolvedValue([
      { title: "M1", content: "só texto", imageUrls: null },
    ]);
    llmReturns("ok");
    await generateCompletion(7, task);
    const messages = (invokeLLM as any).mock.calls[0][0].messages;
    const userMsg = messages.find((m: any) => m.role === "user");
    expect(typeof userMsg.content).toBe("string");
  });

  it("com imagens em memória → user content vira array multimodal com image_url", async () => {
    (db.getUserMemoriesByUserId as any).mockResolvedValue([
      {
        title: "Minha prova",
        content: "resolução manuscrita",
        imageUrls: ["/manus-storage/prova1.jpg", "/uploads/prova2.png"],
      },
    ]);
    llmReturns("ok");
    await generateCompletion(7, task);
    const messages = (invokeLLM as any).mock.calls[0][0].messages;
    const userMsg = messages.find((m: any) => m.role === "user");
    expect(Array.isArray(userMsg.content)).toBe(true);
    const parts = userMsg.content as any[];
    expect(parts[0].type).toBe("text");
    const imageParts = parts.filter((p) => p.type === "image_url");
    expect(imageParts).toHaveLength(2);
    expect(imageParts[0].image_url.url).toBe("/manus-storage/prova1.jpg");
    expect(imageParts[1].image_url.url).toBe("/uploads/prova2.png");

    // System prompt deve mencionar as fotos
    const sys = messages.find((m: any) => m.role === "system").content;
    expect(sys).toMatch(/2 foto\(s\)/i);
  });

  it("cap em 4 imagens totais mesmo se memórias tiverem mais", async () => {
    (db.getUserMemoriesByUserId as any).mockResolvedValue([
      { title: "M1", content: "x", imageUrls: ["a", "b", "c"] },
      { title: "M2", content: "y", imageUrls: ["d", "e", "f"] },
    ]);
    llmReturns("ok");
    await generateCompletion(7, task);
    const userMsg = (invokeLLM as any).mock.calls[0][0].messages.find(
      (m: any) => m.role === "user"
    );
    const imageParts = (userMsg.content as any[]).filter((p) => p.type === "image_url");
    expect(imageParts).toHaveLength(4);
  });

  it("imageUrls não-array (dado sujo) é ignorado sem crashar", async () => {
    (db.getUserMemoriesByUserId as any).mockResolvedValue([
      { title: "M", content: "x", imageUrls: "not-array" as any },
    ]);
    llmReturns("ok");
    await expect(generateCompletion(7, task)).resolves.toBeDefined();
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
