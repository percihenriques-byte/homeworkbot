// Modo DEMONSTRAÇÃO: quando DEMO_MODE=true, o app abre direto num usuário
// "Visitante" fixo, SEM pedir login. Serve pra mostrar o produto sem cadastro.
// DESLIGADO por padrão — em produção o login normal continua valendo.

import type { User } from "../drizzle/schema";
import * as db from "./db";

const DEMO_OPEN_ID = "demo-visitante";

export const demoModeEnabled = () => process.env.DEMO_MODE === "true";

// Garante o usuário-demo no banco e o retorna (sem expor passwordHash).
export async function resolveDemoUser(): Promise<User | null> {
  if (!demoModeEnabled()) return null;
  try {
    await db.upsertUser({
      openId: DEMO_OPEN_ID,
      name: "Visitante",
      email: null,
      loginMethod: "demo",
    } as any);
    const u = await db.getUserByOpenId(DEMO_OPEN_ID);
    return u ? ({ ...u, passwordHash: null } as User) : null;
  } catch {
    return null;
  }
}
