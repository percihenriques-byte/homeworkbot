import { describe, expect, it } from "vitest";
import { buildWhatsappReminderUrl } from "./whatsappUrl";

describe("buildWhatsappReminderUrl", () => {
  it("formato com número válido", () => {
    const url = buildWhatsappReminderUrl({
      phone: "+55 11 99999-1234",
      title: "Prova",
    });
    // Só dígitos no path
    expect(url).toMatch(/^https:\/\/wa\.me\/551199991234\?text=/);
  });

  it("formato sem número quando phone vazio/null/undefined", () => {
    for (const phone of ["", null, undefined]) {
      const url = buildWhatsappReminderUrl({ phone, title: "X" });
      expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    }
  });

  it("formato sem número quando phone tem < 8 dígitos", () => {
    // "+55" só tem 2 dígitos — insuficiente pra número real.
    const url = buildWhatsappReminderUrl({ phone: "+55", title: "X" });
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
  });

  it("mensagem inclui título", () => {
    const url = buildWhatsappReminderUrl({ phone: "5511999991234", title: "Redação" });
    const decoded = decodeURIComponent(url.split("text=")[1]);
    expect(decoded).toContain("Redação");
  });

  it("mensagem inclui subject quando presente", () => {
    const url = buildWhatsappReminderUrl({
      phone: "5511999991234",
      title: "Prova",
      subject: "Matemática",
    });
    const decoded = decodeURIComponent(url.split("text=")[1]);
    expect(decoded).toContain("Prova (Matemática)");
  });

  it("mensagem omite subject quando vazio/null", () => {
    const url = buildWhatsappReminderUrl({
      phone: "5511999991234",
      title: "Prova",
      subject: "",
    });
    const decoded = decodeURIComponent(url.split("text=")[1]);
    expect(decoded).not.toContain("(");
  });

  it("mensagem inclui prazo formatado em pt-BR quando presente", () => {
    // Cria uma data determinística. Mês zero-indexed → 6 = julho.
    const due = new Date(2026, 6, 15);
    const url = buildWhatsappReminderUrl({
      phone: "5511999991234",
      title: "Prova",
      dueDate: due,
    });
    const decoded = decodeURIComponent(url.split("text=")[1]);
    expect(decoded).toContain("15/07/2026");
  });

  it("mensagem inclui 'sem prazo' quando dueDate falta", () => {
    const url = buildWhatsappReminderUrl({
      phone: "5511999991234",
      title: "Prova",
      dueDate: null,
    });
    const decoded = decodeURIComponent(url.split("text=")[1]);
    expect(decoded).toContain("sem prazo");
  });

  it("aceita dueDate como string ISO", () => {
    const url = buildWhatsappReminderUrl({
      phone: "5511999991234",
      title: "Prova",
      dueDate: "2026-07-15T09:00:00.000Z",
    });
    // Só verifica que gera URL válida e não crasha.
    expect(url).toContain("Prova");
  });

  it("aceita caracteres especiais no título sem quebrar URL", () => {
    const url = buildWhatsappReminderUrl({
      phone: "5511999991234",
      title: "A & B / C \"D\" 'E' #F ?G",
    });
    // URL não deve conter caracteres brutos que quebrariam o parse.
    expect(url).not.toMatch(/["'&?]{2,}/);
    const decoded = decodeURIComponent(url.split("text=")[1]);
    expect(decoded).toContain(`A & B / C "D" 'E' #F ?G`);
  });
});
