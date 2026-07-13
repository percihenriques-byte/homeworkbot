import { describe, it, expect } from "vitest";
import { parseIcs, parseIcsDate } from "./parseIcs";

describe("parseIcsDate", () => {
  it("parseia data-only", () => {
    const d = parseIcsDate("20260715");
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(6); // julho (0-indexed)
    expect(d?.getDate()).toBe(15);
  });

  it("parseia datetime UTC (com Z)", () => {
    const d = parseIcsDate("20260715T090000Z");
    expect(d?.toISOString()).toBe("2026-07-15T09:00:00.000Z");
  });

  it("parseia datetime local (sem Z)", () => {
    const d = parseIcsDate("20260715T090000");
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getHours()).toBe(9);
  });

  it("retorna null pra valor inválido", () => {
    expect(parseIcsDate("nao-e-data")).toBeNull();
    expect(parseIcsDate("")).toBeNull();
  });
});

describe("parseIcs", () => {
  const sample = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    "SUMMARY:Prova de Matemática",
    "DTSTART:20260715T090000Z",
    "DESCRIPTION:Capítulos 3 e 4",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "SUMMARY:Entregar redação",
    "DTSTART;VALUE=DATE:20260716",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  it("extrai os eventos com título e prazo", () => {
    const events = parseIcs(sample);
    expect(events).toHaveLength(2);
    expect(events[0].title).toBe("Prova de Matemática");
    expect(events[0].description).toBe("Capítulos 3 e 4");
    expect(events[0].dueDate?.toISOString()).toBe("2026-07-15T09:00:00.000Z");
    expect(events[1].title).toBe("Entregar redação");
    expect(events[1].dueDate?.getDate()).toBe(16);
  });

  it("ignora bloco sem SUMMARY", () => {
    const ics = "BEGIN:VEVENT\r\nDTSTART:20260715\r\nEND:VEVENT";
    expect(parseIcs(ics)).toHaveLength(0);
  });

  it("usa DUE em VTODO", () => {
    const ics = "BEGIN:VTODO\r\nSUMMARY:Lição de casa\r\nDUE:20260720T235900Z\r\nEND:VTODO";
    const events = parseIcs(ics);
    expect(events).toHaveLength(1);
    expect(events[0].dueDate?.toISOString()).toBe("2026-07-20T23:59:00.000Z");
  });

  it("desfaz line folding (continuação com espaço)", () => {
    const ics = [
      "BEGIN:VEVENT",
      "SUMMARY:Trabalho de Ciências",
      "DESCRIPTION:Primeira linha",
      " continuação na mesma frase",
      "END:VEVENT",
    ].join("\r\n");
    const events = parseIcs(ics);
    expect(events[0].description).toBe("Primeira linha continuação na mesma frase");
  });

  it("decodifica escapes de texto (\\, \\n)", () => {
    const ics = "BEGIN:VEVENT\r\nSUMMARY:Ler cap.\\, revisar\\nfazer exercícios\r\nEND:VEVENT";
    const events = parseIcs(ics);
    expect(events[0].title).toContain(",");
    expect(events[0].title).toContain("\n");
  });

  it("valor com ':' (URL na descrição) não quebra", () => {
    const ics = "BEGIN:VEVENT\r\nSUMMARY:Pesquisa\r\nDESCRIPTION:Ver https://exemplo.com/tarefa\r\nEND:VEVENT";
    const events = parseIcs(ics);
    expect(events[0].description).toBe("Ver https://exemplo.com/tarefa");
  });

  it("retorna vazio pra entrada inválida", () => {
    expect(parseIcs("")).toEqual([]);
    expect(parseIcs("qualquer texto sem eventos")).toEqual([]);
  });
});
