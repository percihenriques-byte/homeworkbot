import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: vi.fn() } }));
vi.mock("./email", () => ({ sendReminderEmail: vi.fn() }));
vi.mock("./db", () => ({
  deleteUnsentRemindersForTask: vi.fn(),
  createEmailReminder: vi.fn(),
  getPendingEmailReminders: vi.fn(),
  getTaskById: vi.fn(),
  getIntegrationSettings: vi.fn(),
  getUserById: vi.fn(),
  updateEmailReminder: vi.fn(),
}));

import { syncTaskReminder, sendDueReminders } from "./reminders";
import * as db from "./db";
import { sendReminderEmail } from "./email";

const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => vi.clearAllMocks());

describe("syncTaskReminder", () => {
  it("agenda lembrete 24h antes do prazo futuro (e limpa os antigos)", async () => {
    const due = new Date(2099, 0, 1, 10, 0, 0); // bem no futuro
    await syncTaskReminder(7, { id: 3, dueDate: due, status: "pendente" });
    expect(db.deleteUnsentRemindersForTask).toHaveBeenCalledWith(7, 3);
    expect(db.createEmailReminder).toHaveBeenCalledTimes(1);
    const arg = (db.createEmailReminder as any).mock.calls[0][0];
    expect(arg.reminderTime.getTime()).toBe(due.getTime() - DAY);
    expect(arg.sent).toBe(false);
  });

  it("sem prazo → limpa antigos mas NÃO agenda", async () => {
    await syncTaskReminder(7, { id: 3, dueDate: null, status: "pendente" });
    expect(db.deleteUnsentRemindersForTask).toHaveBeenCalled();
    expect(db.createEmailReminder).not.toHaveBeenCalled();
  });

  it("tarefa concluída → não agenda", async () => {
    await syncTaskReminder(7, { id: 3, dueDate: new Date(2099, 0, 1), status: "concluída" });
    expect(db.createEmailReminder).not.toHaveBeenCalled();
  });

  it("prazo no passado → não agenda", async () => {
    await syncTaskReminder(7, { id: 3, dueDate: new Date(2000, 0, 1), status: "pendente" });
    expect(db.createEmailReminder).not.toHaveBeenCalled();
  });

  it("tarefa 'concluida' (sem acento) também não agenda (regression)", async () => {
    // Antes do accent-insensitive fix, uma tarefa com status 'concluida'
    // (sem acento) escapava do check e o lembrete era criado.
    await syncTaskReminder(7, { id: 3, dueDate: new Date(2099, 0, 1), status: "concluida" });
    expect(db.createEmailReminder).not.toHaveBeenCalled();
  });

  it("prazo em menos de 24h → agenda pra 'agora' (não no passado)", async () => {
    const due = new Date(Date.now() + 2 * 60 * 60 * 1000); // +2h
    await syncTaskReminder(7, { id: 3, dueDate: due, status: "pendente" });
    const arg = (db.createEmailReminder as any).mock.calls[0][0];
    // max(due-24h, now) → ~agora, nunca antes de agora
    expect(arg.reminderTime.getTime()).toBeGreaterThanOrEqual(Date.now() - 5000);
  });
});

describe("sendDueReminders", () => {
  const reminder = { id: 9, taskId: 3, userId: 7 };

  it("envia e marca como enviado quando há Gmail e tarefa pendente", async () => {
    (db.getPendingEmailReminders as any).mockResolvedValue([reminder]);
    (db.getTaskById as any).mockResolvedValue({ title: "Prova", dueDate: new Date(2099, 0, 1), status: "pendente" });
    (db.getIntegrationSettings as any).mockResolvedValue({ gmailUser: "eu@gmail.com", gmailAppPassword: "senha" });
    (db.getUserById as any).mockResolvedValue({ email: "eu@gmail.com" });
    const r = await sendDueReminders();
    expect(sendReminderEmail).toHaveBeenCalledTimes(1);
    expect(db.updateEmailReminder).toHaveBeenCalledWith(9, expect.objectContaining({ sent: true }));
    expect(r).toMatchObject({ sent: 1, failed: 0, skipped: 0 });
  });

  it("tarefa concluída → pula (marca enviado, sem email)", async () => {
    (db.getPendingEmailReminders as any).mockResolvedValue([reminder]);
    (db.getTaskById as any).mockResolvedValue({ title: "X", status: "concluída" });
    const r = await sendDueReminders();
    expect(sendReminderEmail).not.toHaveBeenCalled();
    expect(db.updateEmailReminder).toHaveBeenCalledWith(9, expect.objectContaining({ sent: true }));
    expect(r.skipped).toBe(1);
  });

  it("sem Gmail configurado → pula (não envia)", async () => {
    (db.getPendingEmailReminders as any).mockResolvedValue([reminder]);
    (db.getTaskById as any).mockResolvedValue({ title: "X", status: "pendente" });
    (db.getIntegrationSettings as any).mockResolvedValue({});
    (db.getUserById as any).mockResolvedValue({ email: "eu@x.com" });
    const r = await sendDueReminders();
    expect(sendReminderEmail).not.toHaveBeenCalled();
    expect(r.skipped).toBe(1);
  });

  it("falha no envio → NÃO marca enviado (retenta depois)", async () => {
    (db.getPendingEmailReminders as any).mockResolvedValue([reminder]);
    (db.getTaskById as any).mockResolvedValue({ title: "X", status: "pendente" });
    (db.getIntegrationSettings as any).mockResolvedValue({ gmailUser: "eu@gmail.com", gmailAppPassword: "s" });
    (db.getUserById as any).mockResolvedValue({ email: "eu@gmail.com" });
    (sendReminderEmail as any).mockRejectedValue(new Error("smtp fail"));
    const r = await sendDueReminders();
    expect(db.updateEmailReminder).not.toHaveBeenCalled();
    expect(r.failed).toBe(1);
  });
});
