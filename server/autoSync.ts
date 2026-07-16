// Sync automático interno: enquanto o server tá rodando, a cada 15 min ele
// itera todos os usuários com link de calendário configurado e puxa novas
// tarefas (mesmo pipeline do cron externo). No plano grátis do Render o app
// hiberna quando ninguém acessa — então o intervalo só fica ativo enquanto
// há tráfego (que é quando o usuário abre o app). Pra confiabilidade total
// (24/7 mesmo dormindo), configure o cron externo com CRON_SECRET.
//
// Vantagem sobre depender só de cron externo: assim que o usuário abre o
// app, os dados dele são atualizados sem precisar de config nenhuma.

import * as db from "./db";
import { syncToddleForUser } from "./toddleSync";

const INTERVAL_MS = 15 * 60 * 1000; // 15 min
let started = false;

async function tick() {
  try {
    const users = await db.getUsersWithToddleFeed();
    if (!users?.length) return;
    for (const u of users) {
      try {
        const r = await syncToddleForUser(u.userId);
        if (r.imported > 0 || r.autoCompleted > 0) {
          console.log(
            `[AutoSync] user=${u.userId} novas=${r.imported} feitas-ia=${r.autoCompleted}`
          );
        }
      } catch (err: any) {
        // Sync de um usuário falhar não deve parar os outros.
        console.warn(`[AutoSync] user=${u.userId} falhou: ${String(err?.message ?? err)}`);
      }
    }
  } catch (err: any) {
    console.warn(`[AutoSync] tick falhou: ${String(err?.message ?? err)}`);
  }
}

export function startAutoSync() {
  if (started) return;
  started = true;
  console.log(`[AutoSync] intervalo interno de ${INTERVAL_MS / 60000} min iniciado`);
  // Primeira rodada em 30s (dá tempo do server terminar de subir).
  setTimeout(() => {
    tick().catch(() => {});
    setInterval(() => {
      tick().catch(() => {});
    }, INTERVAL_MS);
  }, 30_000);
}
