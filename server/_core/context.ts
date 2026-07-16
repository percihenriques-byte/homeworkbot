import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { resolveSimpleUser } from "../simpleAuth";
import { resolvePasswordUser } from "../passwordAuth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  // Fallback: login multiusuário por e-mail/senha (fora do Manus).
  if (!user) {
    user = await resolvePasswordUser(opts.req);
  }
  // Fallback: login por senha única (compat / modo simples).
  if (!user) {
    user = await resolveSimpleUser(opts.req);
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
