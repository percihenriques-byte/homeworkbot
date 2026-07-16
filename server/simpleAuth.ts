// Login simples por SENHA ÚNICA, pra substituir o OAuth do Manus quando o
// app roda fora dele. Um cookie assinado (HMAC) guarda a sessão de um único
// usuário local. Ativa quando APP_PASSWORD está definida no ambiente.
//
// Env:
//   APP_PASSWORD  — a senha de acesso (quem souber, entra)
//   JWT_SECRET    — segredo pra assinar o cookie (já usado pelo app)

import type { Express, Request, Response } from "express";
import { parse as parseCookie } from "cookie";
import crypto from "crypto";
import type { User } from "../drizzle/schema";
import * as db from "./db";

const COOKIE = "app_simple_session";
const LOCAL_OPEN_ID = "local-simple-user";
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

const password = () => process.env.APP_PASSWORD ?? "";
const secret = () => process.env.JWT_SECRET || "dev-secret-troque-em-producao";

export const simpleAuthEnabled = () => password().length > 0;

// Exportados pra testar sem express: são puros (secret injetado). O wrapper
// interno usa o secret do env pra manter a API interna curta.
export function signWithSecret(value: string, secretValue: string): string {
  return crypto.createHmac("sha256", secretValue).update(value).digest("base64url");
}

// Token = "<payloadB64>.<assinatura>". Payload simples e fixo (um usuário só).
export function makeTokenWithSecret(secretValue: string): string {
  const payload = Buffer.from(
    JSON.stringify({ openId: LOCAL_OPEN_ID, t: "simple" })
  ).toString("base64url");
  return `${payload}.${signWithSecret(payload, secretValue)}`;
}

export function verifyTokenWithSecret(
  token: string | undefined | null,
  secretValue: string
): boolean {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  // Comparação em tempo constante pra não vazar via timing.
  const expected = signWithSecret(payload, secretValue);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function makeToken(): string {
  return makeTokenWithSecret(secret());
}

function verifyToken(token: string | undefined): boolean {
  return verifyTokenWithSecret(token, secret());
}

function readCookie(req: Request): string | undefined {
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  try {
    return parseCookie(raw)[COOKIE];
  } catch {
    return undefined;
  }
}

// Se o cookie simples for válido, garante o usuário local no banco e o retorna.
// Usado pelo context do tRPC como fallback quando o Manus não autentica.
export async function resolveSimpleUser(req: Request): Promise<User | null> {
  if (!simpleAuthEnabled()) return null;
  if (!verifyToken(readCookie(req))) return null;
  try {
    await db.upsertUser({ openId: LOCAL_OPEN_ID, name: "Aluno", email: null, loginMethod: "senha" } as any);
    return (await db.getUserByOpenId(LOCAL_OPEN_ID)) ?? null;
  } catch {
    return null;
  }
}

export function registerSimpleAuthRoutes(app: Express) {
  app.post("/api/simple-login", (req: Request, res: Response) => {
    if (!simpleAuthEnabled()) {
      return res.status(404).json({ error: "login por senha não está ativo" });
    }
    const sent = String((req.body && (req.body.password ?? req.body.senha)) ?? "");
    // Comparação em tempo constante.
    const ok =
      sent.length === password().length &&
      crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(password()));
    if (!ok) {
      return res.status(401).json({ error: "Senha incorreta." });
    }
    // secure baseado no protocolo REAL da requisição (não em NODE_ENV):
    // HTTPS direto (req.secure) OU atrás de proxy que termina SSL (Render usa
    // header x-forwarded-proto=https). Localhost http → false, senão o browser
    // recusa salvar o cookie.
    const isHttps = req.secure || req.header("x-forwarded-proto") === "https";
    res.cookie(COOKIE, makeToken(), {
      httpOnly: true,
      sameSite: "lax",
      secure: isHttps,
      maxAge: YEAR_MS,
      path: "/",
    });
    return res.json({ success: true });
  });

  app.post("/api/simple-logout", (req: Request, res: Response) => {
    res.clearCookie(COOKIE, { path: "/" });
    return res.json({ success: true });
  });
}
