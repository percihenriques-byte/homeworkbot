// Login MULTIUSUÁRIO por e-mail + senha (cada pessoa tem sua conta e seus
// dados). Substitui o OAuth do Manus. Cada usuário vira uma linha em `users`
// com passwordHash (scrypt). A sessão é um cookie assinado (HMAC) que carrega
// o openId do usuário — o context do tRPC resolve o usuário a partir dele.
//
// Rotas: POST /api/register {name,email,password}, POST /api/login {email,password},
//        POST /api/logout.

import type { Express, Request, Response } from "express";
import { parse as parseCookie } from "cookie";
import crypto from "crypto";
import type { User } from "../drizzle/schema";
import * as db from "./db";

const COOKIE = "app_user_session";
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const secret = () => process.env.JWT_SECRET || "dev-secret-troque-em-producao";

// ---------- senha (scrypt) ----------
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored || !stored.includes(":")) return false;
  const [saltHex, hashHex] = stored.split(":");
  try {
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const actual = crypto.scryptSync(password, salt, expected.length);
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

// openId derivado do e-mail (estável, único, cabe em 64 chars).
export function openIdForEmail(email: string): string {
  const norm = String(email).trim().toLowerCase();
  return "pw:" + crypto.createHash("sha256").update(norm).digest("hex").slice(0, 40);
}

// ---------- cookie de sessão ----------
function sign(value: string): string {
  return crypto.createHmac("sha256", secret()).update(value).digest("base64url");
}
export function makeSessionToken(openId: string): string {
  const payload = Buffer.from(JSON.stringify({ openId })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}
export function openIdFromToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof data?.openId === "string" ? data.openId : null;
  } catch {
    return null;
  }
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

// Resolve o usuário logado a partir do cookie. Usado pelo context do tRPC.
export async function resolvePasswordUser(req: Request): Promise<User | null> {
  const openId = openIdFromToken(readCookie(req));
  if (!openId) return null;
  try {
    const user = await db.getUserByOpenId(openId);
    if (!user) return null;
    // NUNCA expor o hash da senha pro cliente (auth.me devolve o ctx.user).
    return { ...user, passwordHash: null } as User;
  } catch {
    return null;
  }
}

function setSessionCookie(req: Request, res: Response, openId: string) {
  const isHttps = req.secure || req.header("x-forwarded-proto") === "https";
  res.cookie(COOKIE, makeSessionToken(openId), {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps,
    maxAge: YEAR_MS,
    path: "/",
  });
}

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export function registerPasswordAuthRoutes(app: Express) {
  app.post("/api/register", async (req: Request, res: Response) => {
    const name = String(req.body?.name ?? "").trim();
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");

    if (!name) return res.status(400).json({ error: "Informe seu nome." });
    if (!isEmail(email)) return res.status(400).json({ error: "E-mail inválido." });
    if (password.length < 6) return res.status(400).json({ error: "A senha precisa ter ao menos 6 caracteres." });

    const openId = openIdForEmail(email);
    try {
      const existing = await db.getUserByOpenId(openId);
      if (existing) return res.status(409).json({ error: "Esse e-mail já tem conta. Faça login." });

      await db.createPasswordUser({ openId, name, email, passwordHash: hashPassword(password) });
      setSessionCookie(req, res, openId);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: "Não consegui criar a conta agora." });
    }
  });

  app.post("/api/login", async (req: Request, res: Response) => {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");
    if (!isEmail(email) || !password) {
      return res.status(400).json({ error: "Informe e-mail e senha." });
    }
    try {
      const user = await db.getUserByOpenId(openIdForEmail(email));
      if (!user || !verifyPassword(password, (user as any).passwordHash)) {
        return res.status(401).json({ error: "E-mail ou senha incorretos." });
      }
      setSessionCookie(req, res, user.openId);
      return res.json({ success: true });
    } catch {
      return res.status(500).json({ error: "Não consegui entrar agora." });
    }
  });

  app.post("/api/logout", (_req: Request, res: Response) => {
    res.clearCookie(COOKIE, { path: "/" });
    return res.json({ success: true });
  });
}
