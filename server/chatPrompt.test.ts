import { describe, expect, it } from "vitest";
import { buildChatSystemPrompt, MEMORY_LIMIT } from "./chatPrompt";

const NOW = new Date("2026-07-15T15:00:00Z");

describe("buildChatSystemPrompt", () => {
  it("base prompt sempre presente", () => {
    const p = buildChatSystemPrompt({ now: NOW });
    expect(p).toContain("Jarvis de Estudos");
    expect(p).toContain("PLANEJA, EXECUTA e RELATA");
    expect(p).toContain("Português (BR)");
  });

  it("inclui data ISO de hoje e data formatada em pt-BR", () => {
    const p = buildChatSystemPrompt({ now: NOW });
    expect(p).toContain("2026-07-15");
    // dia/mês em pt-BR
    expect(p).toMatch(/15\/07\/2026/);
  });

  it("aiStyle vazio ou undefined não inclui seção de estilo", () => {
    expect(buildChatSystemPrompt({ now: NOW })).not.toContain("Estilo preferido");
    expect(buildChatSystemPrompt({ now: NOW, aiStyle: "" })).not.toContain("Estilo preferido");
    expect(buildChatSystemPrompt({ now: NOW, aiStyle: "   " })).not.toContain("Estilo preferido");
    expect(buildChatSystemPrompt({ now: NOW, aiStyle: null })).not.toContain("Estilo preferido");
  });

  it("aiStyle preenchido aparece no prompt (trimmed)", () => {
    const p = buildChatSystemPrompt({ now: NOW, aiStyle: "  descontraído e direto  " });
    expect(p).toContain("Estilo preferido do usuário: descontraído e direto");
  });

  it("sem task → não inclui seção de tarefa", () => {
    const p = buildChatSystemPrompt({ now: NOW });
    expect(p).not.toContain("Esta conversa está associada");
  });

  it("task com só título → inclui apenas título (não linhas vazias)", () => {
    const p = buildChatSystemPrompt({
      now: NOW,
      task: { title: "Prova de História" },
    });
    expect(p).toContain("- Título: Prova de História");
    expect(p).not.toContain("- Disciplina:");
    expect(p).not.toContain("- Tipo:");
    expect(p).not.toContain("- Prazo:");
    expect(p).not.toContain("- Descrição:");
    expect(p).not.toContain("- Anotações");
  });

  it("task completa inclui todos os campos formatados", () => {
    const p = buildChatSystemPrompt({
      now: NOW,
      task: {
        title: "Ensaio Independência",
        subject: "História",
        type: "redação",
        // Noon UTC pra não flutuar de fuso: em qualquer TZ [-12..+11] cai em 20/07.
        dueDate: new Date("2026-07-20T12:00:00Z"),
        description: "1000 palavras",
        notes: "usar fontes primárias",
      },
    });
    expect(p).toContain("- Título: Ensaio Independência");
    expect(p).toContain("- Disciplina: História");
    expect(p).toContain("- Tipo: redação");
    expect(p).toMatch(/- Prazo: 20\/07\/2026/);
    expect(p).toContain("- Descrição: 1000 palavras");
    expect(p).toContain("- Anotações do usuário: usar fontes primárias");
  });

  it("task com dueDate como string ISO também formata", () => {
    const p = buildChatSystemPrompt({
      now: NOW,
      task: { title: "T", dueDate: "2026-08-01T12:00:00Z" },
    });
    expect(p).toMatch(/- Prazo: \d{2}\/\d{2}\/2026/);
  });

  it("array vazio de memórias → não inclui seção", () => {
    const p = buildChatSystemPrompt({ now: NOW, memories: [] });
    expect(p).not.toContain("Memórias e referências");
  });

  it("memórias aparecem com título, categoria (opcional) e snippet", () => {
    const p = buildChatSystemPrompt({
      now: NOW,
      memories: [
        { title: "Conversa ChatGPT", category: "estilo", content: "eu gosto de listas" },
        { title: "Anotação", content: "prefiro tom informal" }, // sem categoria
      ],
    });
    expect(p).toContain("- Conversa ChatGPT (estilo): eu gosto de listas");
    expect(p).toContain("- Anotação: prefiro tom informal");
    expect(p).not.toContain("Anotação (): "); // não põe parênteses vazio
  });

  it("memória > 300 chars é truncada com '...'", () => {
    const longContent = "a".repeat(500);
    const p = buildChatSystemPrompt({
      now: NOW,
      memories: [{ title: "Longa", content: longContent }],
    });
    expect(p).toContain("a".repeat(300) + "...");
    expect(p).not.toContain("a".repeat(301));
  });

  it("respeita MEMORY_LIMIT (5) — descarta memórias além disso", () => {
    const many = Array.from({ length: MEMORY_LIMIT + 3 }, (_, i) => ({
      title: `mem${i}`,
      content: `conteudo${i}`,
    }));
    const p = buildChatSystemPrompt({ now: NOW, memories: many });
    for (let i = 0; i < MEMORY_LIMIT; i++) {
      expect(p).toContain(`mem${i}`);
    }
    for (let i = MEMORY_LIMIT; i < many.length; i++) {
      expect(p).not.toContain(`mem${i}`);
    }
  });

  it("prompt é determinístico com mesmo `now`", () => {
    const a = buildChatSystemPrompt({ now: NOW, aiStyle: "x" });
    const b = buildChatSystemPrompt({ now: NOW, aiStyle: "x" });
    expect(a).toBe(b);
  });
});
