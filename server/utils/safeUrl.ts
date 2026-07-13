// Guard de SSRF para URLs fornecidas pelo usuário (ex: link de calendário
// .ics do Toddle). Só permite http/https e bloqueia hosts internos/privados,
// pra o servidor não acabar batendo em endereços locais. Módulo puro
// (sem I/O) — testável isoladamente.

export function isSafeFeedUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  let host = u.hostname.toLowerCase();
  // No WHATWG URL, IPs IPv6 vêm entre colchetes no hostname (ex: "[::1]").
  const isIpv6 = host.startsWith("[") && host.endsWith("]");
  if (isIpv6) host = host.slice(1, -1);
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.endsWith(".local") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    // Faixas privadas/link-local IPv6 (só quando é literal IPv6).
    (isIpv6 && (host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd") || host === "::"))
  ) {
    return false;
  }
  return true;
}
