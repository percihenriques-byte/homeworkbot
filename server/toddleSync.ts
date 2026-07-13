// Sincronização automática de tarefas a partir de um LINK de calendário
// (.ics) — Toddle, Google Calendar, Outlook. O usuário cola o link uma vez
// nas Configurações (guardado em integrationSettings.toddleApiKey) e o app
// busca sozinho, periodicamente, via o cron da plataforma. Sem interação
// repetida e sem depender de login/scraping frágil do Toddle.

import type { Express, Request, Response } from "express";
import { sdk } from "./_core/sdk";
import * as db from "./db";
import { parseIcs } from "./utils/parseIcs";
import { syncTaskReminder } from "./reminders";
import { completeAndEmailTask } from "./autoComplete";

export type SyncResult = { imported: number; skipped: number; total: number; autoCompleted: number; emailed: number };

// Máximo de tarefas auto-completadas por execução (protege o timeout de 2min
// do cron; cada uma é uma chamada ao LLM).
const MAX_AUTO_PER_RUN = 8;

// Guard básico de SSRF: só permite http/https e bloqueia hosts internos.
// Evita que um link malicioso faça o servidor bater em endereços locais.
export function isSafeFeedUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    return false;
  }
  return true;
}

// Busca o feed, parseia e cria as tarefas novas do usuário. Dedup por
// (título + dia do prazo) contra as tarefas existentes. Não lança para
// "nada novo" — só para erros reais (URL inválida, feed inacessível).
export async function syncToddleForUser(userId: number): Promise<SyncResult> {
  const settings = await db.getIntegrationSettings(userId);
  const feedUrl = (settings?.toddleApiKey || "").trim();
  if (!feedUrl) {
    throw new Error(
      "Nenhum link de calendário configurado. Cole o link .ics do Toddle em Configurações."
    );
  }
  if (!isSafeFeedUrl(feedUrl)) {
    throw new Error("O link do calendário é inválido. Use um endereço http(s) público do feed .ics.");
  }

  // webcal:// é comum em links de assinatura — troca por https.
  const fetchUrl = feedUrl.replace(/^webcal:\/\//i, "https://");

  let text = "";
  try {
    const resp = await fetch(fetchUrl, {
      headers: { Accept: "text/calendar, text/plain, */*" },
      redirect: "follow",
    });
    if (!resp.ok) {
      throw new Error(`o servidor do calendário respondeu ${resp.status}`);
    }
    text = await resp.text();
  } catch (err: any) {
    throw new Error(`Não consegui acessar o calendário: ${String(err?.message ?? err)}`);
  }

  const events = parseIcs(text);
  if (events.length === 0) {
    return { imported: 0, skipped: 0, total: 0, autoCompleted: 0, emailed: 0 };
  }

  // Se a automação total estiver ligada (toddleEnabled), cada tarefa NOVA é
  // completada pela IA no estilo do usuário e enviada por e-mail.
  const autoDo = settings?.toddleEnabled === true;

  const existing = await db.getTasksByUserId(userId);
  const keyOf = (title: string, due: Date | null) =>
    `${title.trim().toLowerCase()}|${due ? new Date(due).toISOString().slice(0, 10) : ""}`;
  const seen = new Set(
    existing.map((t) => keyOf(t.title, t.dueDate ? new Date(t.dueDate) : null))
  );

  let imported = 0;
  let skipped = 0;
  let autoCompleted = 0;
  let emailed = 0;
  for (const ev of events) {
    const key = keyOf(ev.title, ev.dueDate);
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    const created = await db.createTask({
      userId,
      title: ev.title.slice(0, 255),
      description: ev.description ? ev.description.slice(0, 5000) : undefined,
      dueDate: ev.dueDate ?? undefined,
    });
    if (created) await syncTaskReminder(userId, created as any);
    imported++;

    // Pipeline autônomo: fazer a tarefa com IA e mandar por e-mail.
    // Teto por execução: cada uma é uma chamada LLM (~5-15s); o handler do
    // cron tem limite de 2 min. Acima do teto, a tarefa fica pro usuário
    // fazer manualmente (botão da IA na tarefa).
    if (autoDo && created && autoCompleted < MAX_AUTO_PER_RUN) {
      const r = await completeAndEmailTask(userId, created as any);
      if (r.completed) autoCompleted++;
      if (r.emailed) emailed++;
    }
  }
  return { imported, skipped, total: events.length, autoCompleted, emailed };
}

// Rota do cron: sincroniza TODOS os usuários que têm link configurado.
// Roda periodicamente sem nenhuma interação. Idempotente (dedup por tarefa).
export function registerToddleSyncRoute(app: Express) {
  app.post("/api/scheduled/sync-toddle", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) {
        return res.status(403).json({ error: "cron-only" });
      }
      const users = await db.getUsersWithToddleFeed();
      let totalImported = 0;
      let failures = 0;
      for (const u of users) {
        try {
          const r = await syncToddleForUser(u.userId);
          totalImported += r.imported;
        } catch (err) {
          failures++;
          console.error(`[ToddleSync] falha no usuário ${u.userId}:`, err);
        }
      }
      return res.json({ ok: true, users: users.length, imported: totalImported, failures });
    } catch (err: any) {
      return res.status(500).json({
        error: String(err?.message ?? err),
        stack: err?.stack,
        context: { url: "/api/scheduled/sync-toddle" },
        timestamp: new Date().toISOString(),
      });
    }
  });
}
