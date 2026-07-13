// Sistema de lembretes automáticos por e-mail. Sem API externa paga: usa
// o Gmail SMTP que o usuário já configura (nodemailer) para o envio, e o
// cron da própria plataforma (Heartbeat → /api/scheduled/*) para disparar
// periodicamente. Ver references/periodic-updates.md.

import type { Express, Request, Response } from "express";
import { sdk } from "./_core/sdk";
import * as db from "./db";
import { sendReminderEmail } from "./email";

const DAY_MS = 24 * 60 * 60 * 1000;

type TaskLike = {
  id: number;
  dueDate?: Date | string | null;
  status?: string | null;
};

// (Re)agenda o lembrete de uma tarefa. Apaga os lembretes ainda não
// enviados dela e, se a tarefa tiver prazo futuro e não estiver concluída,
// cria UM lembrete para 24h antes do prazo (ou "agora" se faltar menos que
// isso — o próximo tick do cron manda). Chamado ao criar/editar/deletar.
export async function syncTaskReminder(userId: number, task: TaskLike | undefined | null) {
  if (!task) return;
  await db.deleteUnsentRemindersForTask(userId, task.id);

  if (!task.dueDate) return;
  if (task.status === "concluída") return;
  const due = new Date(task.dueDate).getTime();
  if (!Number.isFinite(due)) return;

  const now = Date.now();
  if (due <= now) return; // prazo já passou — não adianta lembrar

  const remindAt = Math.max(due - DAY_MS, now);
  await db.createEmailReminder({
    userId,
    taskId: task.id,
    reminderTime: new Date(remindAt),
    sent: false,
  });
}

export type DispatchResult = { sent: number; failed: number; skipped: number };

// Varre os lembretes vencidos (reminderTime <= agora, sent = false) e envia
// cada um por e-mail. Idempotente: marca sent=true após enviar, então
// re-execuções do cron não reenviam. Falhas de envio NÃO marcam sent —
// tentam de novo no próximo tick.
export async function sendDueReminders(): Promise<DispatchResult> {
  const due = await db.getPendingEmailReminders();
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const rem of due) {
    try {
      const task = await db.getTaskById(rem.taskId, rem.userId);
      // Tarefa apagada ou já concluída → não faz sentido lembrar. Marca
      // como enviado pra tirar da fila.
      if (!task || task.status === "concluída") {
        await db.updateEmailReminder(rem.id, { sent: true, sentAt: new Date() });
        skipped++;
        continue;
      }

      const settings = await db.getIntegrationSettings(rem.userId);
      const user = await db.getUserById(rem.userId);
      const toEmail = settings?.gmailUser || user?.email || "";
      const gmailUser = settings?.gmailUser || undefined;
      const gmailPass = settings?.gmailAppPassword || undefined;

      // Sem Gmail configurado não há como enviar de verdade (o fallback
      // Ethereal é só teste). Tira da fila pra não acumular; quando o
      // usuário configurar, os PRÓXIMOS lembretes já saem.
      if (!toEmail || !gmailUser || !gmailPass) {
        await db.updateEmailReminder(rem.id, { sent: true, sentAt: new Date() });
        skipped++;
        continue;
      }

      const dueStr = task.dueDate
        ? new Date(task.dueDate).toLocaleDateString("pt-BR")
        : "sem prazo definido";

      await sendReminderEmail(
        toEmail,
        task.title,
        dueStr,
        gmailUser,
        gmailPass,
        settings?.emailSenderName || undefined
      );
      await db.updateEmailReminder(rem.id, { sent: true, sentAt: new Date() });
      sent++;
    } catch (err) {
      console.error(`[Reminders] falha ao enviar lembrete ${rem.id}:`, err);
      failed++;
      // Não marca sent → retenta no próximo tick.
    }
  }

  return { sent, failed, skipped };
}

// Registra a rota de callback do cron. A plataforma (Heartbeat) faz POST
// aqui periodicamente. Autentica via SDK e exige user.isCron. Ver
// periodic-updates.md §3 passo 2/3. DEVE ser montada antes do fallthrough
// do Vite/estático.
export function registerReminderRoutes(app: Express) {
  app.post("/api/scheduled/send-reminders", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) {
        return res.status(403).json({ error: "cron-only" });
      }
      const result = await sendDueReminders();
      return res.json({ ok: true, ...result });
    } catch (err: any) {
      // 500 com erro serializado — o fluxo Investigate da plataforma mostra
      // isso literalmente.
      return res.status(500).json({
        error: String(err?.message ?? err),
        stack: err?.stack,
        context: { url: "/api/scheduled/send-reminders" },
        timestamp: new Date().toISOString(),
      });
    }
  });
}
