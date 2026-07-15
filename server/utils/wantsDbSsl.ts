// Heurística: essa DATABASE_URL exige SSL?
// Bancos gerenciados (TiDB Cloud, PlanetScale, Aiven, Render...) só
// aceitam conexão TLS. O mysql2 não liga SSL só pelo query string,
// então detectamos aqui e ativamos manualmente em getDb().
//
// Extraído pra testar sem instanciar drizzle. Puro (só lê strings).

// Provedores gerenciados conhecidos que exigem SSL.
const MANAGED_HOSTS = [
  "tidbcloud.com",
  "psdb.cloud",
  "planetscale",
  "aivencloud.com",
  "render.com",
];

/**
 * Devolve true quando a URL / env sinaliza que queremos SSL.
 * Regras (qualquer uma que dispara):
 *   - env DB_SSL === "true"
 *   - URL contém "sslaccept", "ssl-mode" ou "ssl=true"
 *   - host da URL é de um provedor gerenciado conhecido
 */
export function wantsDbSsl(url: string, dbSslEnv?: string | null): boolean {
  if (dbSslEnv === "true") return true;
  if (!url || typeof url !== "string") return false;
  if (/sslaccept|ssl-mode|ssl=true/i.test(url)) return true;
  const lower = url.toLowerCase();
  for (const host of MANAGED_HOSTS) {
    if (lower.includes(host)) return true;
  }
  return false;
}
