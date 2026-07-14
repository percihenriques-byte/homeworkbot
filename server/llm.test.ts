import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { toGeminiSchema, toGeminiTools, invokeLLM } from "./llm";
import { AGENT_TOOLS } from "./agentTools";

describe("toGeminiSchema", () => {
  it("converte tipos pra MAIÚSCULO e preserva enum/required/description", () => {
    const out = toGeminiSchema({
      type: "object",
      properties: {
        title: { type: "string", description: "o título" },
        priority: { type: "string", enum: ["baixa", "alta"] },
        qtd: { type: "number" },
      },
      required: ["title"],
    });
    expect(out.type).toBe("OBJECT");
    expect(out.properties.title.type).toBe("STRING");
    expect(out.properties.title.description).toBe("o título");
    expect(out.properties.priority.enum).toEqual(["baixa", "alta"]);
    expect(out.properties.qtd.type).toBe("NUMBER");
    expect(out.required).toEqual(["title"]);
  });
});

describe("toGeminiTools", () => {
  it("converte todas as ferramentas do agente em functionDeclarations", () => {
    const result = toGeminiTools(AGENT_TOOLS as any);
    expect(result).toHaveLength(1);
    const decls = result[0].functionDeclarations;
    const names = decls.map((d: any) => d.name);
    // As 7 ferramentas do Jarvis
    expect(names).toContain("criar_tarefa");
    expect(names).toContain("gerar_flashcards");
    expect(names).toContain("marcar_tarefa_concluida");
    expect(names).toContain("listar_tarefas");
    // criar_tarefa tem parâmetros (com required title)
    const criar = decls.find((d: any) => d.name === "criar_tarefa");
    expect(criar.parameters.type).toBe("OBJECT");
    expect(criar.parameters.required).toContain("title");
    // Ferramentas sem parâmetros (listar_tarefas) NÃO mandam parameters (Gemini rejeita OBJECT vazio)
    const listar = decls.find((d: any) => d.name === "listar_tarefas");
    expect(listar.parameters).toBeUndefined();
  });
});

describe("invokeLLM via Gemini (fetch mockado)", () => {
  let lastBody: any;

  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "chave-de-teste");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function stubGemini(parts: any[]) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: any) => {
        lastBody = JSON.parse(init.body);
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts } }] }) };
      })
    );
  }

  it("monta a requisição certa (system + tools) e devolve o texto", async () => {
    stubGemini([{ text: "Olá! Sou o Jarvis." }]);
    const res = await invokeLLM({
      messages: [
        { role: "system", content: "Você é o Jarvis." } as any,
        { role: "user", content: "oi" } as any,
      ],
      tools: AGENT_TOOLS as any,
      toolChoice: "auto",
    });

    // Requisição no formato Gemini
    expect(lastBody.systemInstruction.parts[0].text).toContain("Jarvis");
    expect(lastBody.contents[0]).toEqual({ role: "user", parts: [{ text: "oi" }] });
    expect(lastBody.tools[0].functionDeclarations.length).toBeGreaterThan(0);
    expect(lastBody.toolConfig.functionCallingConfig.mode).toBe("AUTO");

    // Resposta convertida pro formato que o app espera
    expect(res.choices[0].message.content).toBe("Olá! Sou o Jarvis.");
  });

  it("converte functionCall do Gemini em tool_calls estilo OpenAI", async () => {
    stubGemini([
      { functionCall: { name: "criar_tarefa", args: { title: "Prova de Mat", dueDate: "2026-07-18" } } },
    ]);
    const res = await invokeLLM({
      messages: [{ role: "user", content: "cria uma tarefa" } as any],
      tools: AGENT_TOOLS as any,
    });

    const calls = (res.choices[0].message as any).tool_calls;
    expect(calls).toHaveLength(1);
    expect(calls[0].type).toBe("function");
    expect(calls[0].function.name).toBe("criar_tarefa");
    expect(JSON.parse(calls[0].function.arguments)).toEqual({ title: "Prova de Mat", dueDate: "2026-07-18" });
  });

  it("propaga erro do Gemini (resposta !ok)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 429, text: async () => "limite" })));
    await expect(
      invokeLLM({ messages: [{ role: "user", content: "oi" } as any] })
    ).rejects.toThrow(/Gemini falhou/);
  });
});
