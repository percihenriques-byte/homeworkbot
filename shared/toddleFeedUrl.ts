// Classifica um link .ics que o usuário cola em Configurações (Toddle,
// Google Calendar, Outlook). Devolve motivo em PT-BR pra mostrar inline —
// muito melhor que só descobrir que tá errado quando o cron falha.
//
// Nota: isto NÃO é um guard de SSRF (isso vive em server/utils/safeUrl.ts).
// Aqui só validamos a forma pro usuário ter feedback imediato.

export type FeedUrlResult =
  | { ok: true; normalized: string }
  | { ok: false; reason: FeedUrlError; message: string };

export type FeedUrlError =
  | "empty"
  | "not-url"
  | "bad-protocol"
  | "no-host";

const MESSAGES: Record<FeedUrlError, string> = {
  empty: "Cole o link do calendário.",
  "not-url": "Isso não parece um link. Copie o endereço completo (começa com https:// ou webcal://).",
  "bad-protocol": "Use um link http, https ou webcal.",
  "no-host": "O link está incompleto — falta o servidor (ex: calendar.google.com).",
};

export function classifyFeedUrl(raw: string | null | undefined): FeedUrlResult {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) {
    return { ok: false, reason: "empty", message: MESSAGES.empty };
  }
  // webcal:// é o esquema padrão de "assinatura" de calendário. Convertemos
  // pra https:// pra o fetch funcionar depois — mas antes disso, valida.
  const forParsing = trimmed.replace(/^webcal:\/\//i, "https://");
  let u: URL;
  try {
    u = new URL(forParsing);
  } catch {
    return { ok: false, reason: "not-url", message: MESSAGES["not-url"] };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, reason: "bad-protocol", message: MESSAGES["bad-protocol"] };
  }
  if (!u.hostname) {
    return { ok: false, reason: "no-host", message: MESSAGES["no-host"] };
  }
  // Normalizado (com https:// se veio webcal://). O que o usuário digitou
  // continua salvo cru — a normalização é só pra fetch.
  return { ok: true, normalized: u.toString() };
}
