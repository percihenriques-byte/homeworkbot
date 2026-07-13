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

  it("desfaz line folding (RFC 5545: remove o espaço inicial e concatena)", () => {
    // O fold do iCalendar quebra a 75 octetos, às vezes no meio de uma
    // palavra. O unfolding remove o CRLF + 1 espaço/tab e junta SEM espaço.
    const ics = [
      "BEGIN:VEVENT",
      "SUMMARY:Trabalho de Ciências",
      "DESCRIPTION:Estudar a parte de biolo",
      " gia celular",
      "END:VEVENT",
    ].join("\r\n");
    const events = parseIcs(ics);
    expect(events[0].description).toBe("Estudar a parte de biologia celular");
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

  it("parseia um calendário realista (Google/Outlook: VTIMEZONE, TZID, X-props)", () => {
    // VTIMEZONE não tem SUMMARY → deve ser ignorado. DTSTART;TZID e props X-
    // não podem atrapalhar. Deve extrair só os 2 VEVENTs com título.
    const ics = [
      "BEGIN:VCALENDAR",
      "PRODID:-//Google Inc//Google Calendar 70.9054//EN",
      "VERSION:2.0",
      "CALSCALE:GREGORIAN",
      "BEGIN:VTIMEZONE",
      "TZID:America/Sao_Paulo",
      "BEGIN:STANDARD",
      "TZOFFSETFROM:-0300",
      "TZOFFSETTO:-0300",
      "TZNAME:-03",
      "DTSTART:19700101T000000",
      "END:STANDARD",
      "END:VTIMEZONE",
      "BEGIN:VEVENT",
      "DTSTART;TZID=America/Sao_Paulo:20260717T140000",
      "DTEND;TZID=America/Sao_Paulo:20260717T150000",
      "DTSTAMP:20260713T120000Z",
      "UID:abc123@google.com",
      "CREATED:20260701T100000Z",
      "DESCRIPTION:Estudar capitulos 3 e 4",
      "LAST-MODIFIED:20260701T100000Z",
      "SEQUENCE:0",
      "STATUS:CONFIRMED",
      "SUMMARY:Prova de Historia",
      "TRANSP:OPAQUE",
      "X-GOOGLE-CONFERENCE:ignore",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "DTSTART;VALUE=DATE:20260720",
      "DTEND;VALUE=DATE:20260721",
      "UID:def456@google.com",
      "SUMMARY:Entregar trabalho de Geografia",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const events = parseIcs(ics);
    expect(events).toHaveLength(2);
    expect(events[0].title).toBe("Prova de Historia");
    expect(events[0].description).toBe("Estudar capitulos 3 e 4");
    // DTSTART;TZID=... → pega o valor após o ':' (o parser trata como local).
    expect(events[0].dueDate?.getFullYear()).toBe(2026);
    expect(events[0].dueDate?.getMonth()).toBe(6); // julho
    expect(events[0].dueDate?.getDate()).toBe(17);
    expect(events[1].title).toBe("Entregar trabalho de Geografia");
    expect(events[1].dueDate?.getDate()).toBe(20);
  });
});
