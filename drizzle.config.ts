import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

// Bancos gerenciados (TiDB Cloud, PlanetScale, Aiven) exigem TLS. Quando for
// um deles (ou DB_SSL=true), passamos credenciais por componente + ssl, porque
// o modo "url" do drizzle-kit não aceita a opção ssl.
const needsSsl =
  process.env.DB_SSL === "true" ||
  /tidbcloud\.com|planetscale|psdb\.cloud|aivencloud\.com/i.test(connectionString);

const dbCredentials = needsSsl
  ? (() => {
      const u = new URL(connectionString);
      return {
        host: u.hostname,
        port: Number(u.port || 3306),
        user: decodeURIComponent(u.username),
        password: decodeURIComponent(u.password),
        database: u.pathname.replace(/^\//, "") || "test",
        ssl: { minVersion: "TLSv1.2" as const, rejectUnauthorized: true },
      };
    })()
  : { url: connectionString };

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials,
});
