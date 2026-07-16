// Guarda os endpoints /api/scheduled/*. Aceita duas fontes de autenticação:
//   1) SDK do Manus (quando o app roda lá, é a plataforma que bate)
//   2) Header `x-cron-secret` batendo com o env CRON_SECRET (cron externo:
//      cron-job.org, GitHub Actions, EasyCron etc.)
// Fora dos dois, 403. Sem CRON_SECRET configurado, o modo 2 fica desligado
// (só o Manus passa). Isso permite rodar o app em qualquer host grátis sem
// depender do agendador da plataforma.
import type { Request } from "express";
import { sdk } from "../_core/sdk";

export async function isAuthorizedCron(req: Request): Promise<boolean> {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (secret) {
    const header = req.header("x-cron-secret") || "";
    if (constantTimeEqual(header, secret)) return true;
  }
  try {
    const user = await sdk.authenticateRequest(req);
    return user.isCron === true && !!user.taskUid;
  } catch {
    return false;
  }
}

// Comparação em tempo constante evita timing attack no segredo.
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
