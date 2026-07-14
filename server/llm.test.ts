import { describe, it, expect } from "vitest";
import { toGeminiSchema, toGeminiTools } from "./llm";
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
