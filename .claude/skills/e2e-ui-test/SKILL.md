---
name: e2e-ui-test
description: Escrever e rodar testes E2E do homeworkbot que exercitam a INTERFACE como um usuário real (Playwright + Chromium), com o backend tRPC mockado por página. Use quando pedirem para testar fluxos de UI (criar tarefa, chat, configurações), reproduzir um bug de tela, ou garantir que a interface funciona ponta a ponta sem precisar de banco/LLM/OAuth reais.
---

# Testes E2E "como um usuário" (Playwright)

Estes testes abrem o **Chromium de verdade**, carregam o app buildado e clicam/digitam
como um usuário. O backend (tRPC) é **mockado por página**, então não precisa de MySQL,
LLM nem OAuth — os dados vêm de um estado em memória mutável (`e2e/mock.ts`).

## Setup (uma vez)

O Playwright é instalado à parte, **de propósito NÃO está no package.json** — o Manus builda
com `pnpm --frozen-lockfile`, e uma devDependency que não está no `pnpm-lock.yaml` quebraria o
deploy. Instale local (fica no node_modules, fora do lockfile do pnpm):

```powershell
& "$nodeDir\npm.cmd" install -D --legacy-peer-deps --no-save "@playwright/test@latest"
& "$nodeDir\node.exe" "node_modules\@playwright\test\cli.js" install chromium
```

(`--no-save` evita mexer no package.json/lock; se mexer, reverta antes de commitar.)

## Como rodar

O ambiente local geralmente NÃO tem Node no PATH — use o Node portátil do scratchpad
(ver a auto-memory `project_homework_assistant.md`). Em cada chamada PowerShell:

```powershell
$nodeDir = "<scratchpad>\node-v22.12.0-win-x64"   # caminho do Node portátil
$env:Path = "$nodeDir;$env:Path"
Set-Location "C:\Users\PERCI HENRIQUES\homeworkbot"

# 1. Buildar o frontend ANTES (o servidor de teste serve o dist buildado):
& "$nodeDir\npm.cmd" run build

# 2. (higiene) matar servidor zumbi na porta 3100:
Get-NetTCPConnection -LocalPort 3100 -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }

# 3. Rodar os E2E:
& "$nodeDir\node.exe" "node_modules\@playwright\test\cli.js" test
# ou um arquivo: ... cli.js test e2e/tasks.spec.ts
```

Scripts equivalentes (se `playwright` estiver no PATH): `npm run test:e2e`.

**IMPORTANTE:** rebuilde (`npm run build`) SEMPRE que mudar código do client, senão o
servidor serve o bundle antigo. O `playwright.config.ts` usa `reuseExistingServer: false`
e sobe `node dist/index.js` na porta 3100 (sobe sem env, só loga OAuth faltando).

## Como escrever um teste de fluxo

```ts
import { test, expect } from "@playwright/test";
import { installTrpcMock, authedUser } from "./mock";

test("usuário faz X pela interface", async ({ page }) => {
  // Mocka o backend. Passe user:null para tela de visitante, authedUser para logado.
  // Passe estado inicial: { tasks: [...], memories: [...], integrationSettings: {...} }.
  await installTrpcMock(page, { user: authedUser, tasks: [] });

  await page.goto("/tarefas");
  await page.getByRole("button", { name: "Nova Tarefa" }).first().click();
  await page.getByPlaceholder("Digite o título da tarefa").fill("Prova de Mat");
  await page.getByRole("button", { name: "Criar" }).click();
  await expect(page.getByText("Prova de Mat")).toBeVisible();
});
```

Prefira seletores de usuário: `getByRole`, `getByText`, `getByPlaceholder`, `getByLabel`.

## O mock (`e2e/mock.ts`)

`installTrpcMock(page, overrides)` intercepta `**/api/trpc/**`, entende o batch + superjson
e responde do estado em memória. Já cobre: `auth.me`, `tasks.*` (list/create/update/delete,
com estado real → "criar → aparece"), `conversations.list`, `memories.*`, `integrationSettings.get`,
`flashcards/quizzes/studyGuides.list`, `schedule.get`. Para cobrir uma procedure nova, adicione
um `case` em `resolve()`.

## Rotas do app (wouter)

`/` = landing (Home, visível a visitante). Protegidas redirecionam pra `/` se `auth.me` = null:
`/painel` `/tarefas` `/chat` `/ferramentas` `/cronograma` `/memorias` `/configuracoes`.

## Armadilhas já descobertas

- **Build local sem env**: `getLoginUrl()` já é defensivo (não derruba o app se `VITE_OAUTH_PORTAL_URL`
  faltar). O `<script %VITE_ANALYTICS_ENDPOINT%/umami>` do index.html loga erro 404/MIME local —
  é ruído inofensivo (Manus substitui em produção). Não trate como falha de teste.
- **Servidor zumbi na 3100** servindo build antigo → mate o processo antes de rodar (passo 2).
- Assertar ausência de erros de runtime: escute `page.on("pageerror", ...)` (uncaught JS), NÃO
  `console` (que pega o ruído do analytics).
