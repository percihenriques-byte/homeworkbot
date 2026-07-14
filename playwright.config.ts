import { defineConfig, devices } from "@playwright/test";

// Testes E2E "como um usuário": dirigem o Chromium na interface real.
// O backend (tRPC) é mockado por página (e2e/mock.ts), então não precisa de
// banco/LLM/OAuth reais. O servidor de produção serve o frontend buildado.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Assume `dist/` já buildado (rode `npm run build` antes). Sobe sem env:
    // só loga OAuth faltando; os dados vêm do mock de tRPC.
    command: "node dist/index.js",
    env: { NODE_ENV: "production", PORT: "3100" },
    url: "http://localhost:3100",
    timeout: 60_000,
    reuseExistingServer: false,
  },
});
