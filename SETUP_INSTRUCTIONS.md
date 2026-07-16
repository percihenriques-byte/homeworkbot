# Homework Assistant — Setup & Deployment

Assistente escolar full-stack em React + TypeScript + Express + tRPC + MySQL.

Roda **fora do Manus**: login por senha, IA Gemini (grátis), banco TiDB Cloud (grátis), hospedagem Render (grátis). Sem OAuth, sem dependência de plataforma proprietária.

## Pré-requisitos

- Node.js 22+ e pnpm
- Banco MySQL/TiDB (grátis em [TiDB Cloud Serverless](https://tidbcloud.com))
- Chave da Gemini API (grátis em [aistudio.google.com/apikey](https://aistudio.google.com/apikey))

## Instalação local

1. **Instalar dependências:**
   ```bash
   pnpm install
   ```

2. **Criar `.env`** copiando de `.env.example` e preenchendo:
   ```
   DATABASE_URL=mysql://usuario:senha@host:4000/test?sslaccept=strict
   JWT_SECRET=texto-longo-e-aleatorio
   GEMINI_API_KEY=cole-sua-chave-gemini
   ```
   
   *Login é por **cadastro multiusuário** (nome + e-mail + senha). Cada pessoa
   cria a conta pela própria tela. Não precisa `APP_PASSWORD` (só é necessário
   se você quiser o modo "senha única legada" via `/api/simple-login`).*

3. **Rodar migrações:**
   ```bash
   pnpm drizzle-kit migrate
   ```

4. **Subir em dev:**
   ```bash
   pnpm dev
   ```

   Frontend em `http://localhost:5173`, backend em `http://localhost:3000/api/trpc`.

## Estrutura do projeto

```
homeworkbot/
├── client/                # Frontend React
│   └── src/
│       ├── pages/         # Chat, Tasks, Memories, Settings, etc.
│       ├── components/    # UI reutilizável
│       ├── hooks/         # Custom hooks
│       ├── lib/           # Cliente tRPC
│       └── contexts/      # ThemeContext, etc.
├── server/                # Backend Express
│   ├── routers.ts         # Rotas tRPC
│   ├── db.ts              # Helpers do banco
│   ├── llm.ts             # Integração Gemini
│   ├── email.ts           # SMTP Gmail
│   ├── toddleSync.ts      # Import de .ics (Toddle, Google Cal, Outlook)
│   ├── reminders.ts       # Lembretes agendados
│   └── *.test.ts          # Vitest
├── drizzle/               # Schema + migrações do banco
├── shared/                # Tipos e utilitários compartilhados
└── COMO-PUBLICAR-DE-GRACA.md  # Guia passo-a-passo de deploy
```

## Funcionalidades

### Autenticação
- **Cadastro multiusuário** por e-mail + senha (scrypt hash) — sem OAuth externo
- Cada usuário tem sua conta e seus dados isolados
- Sessão via cookie assinado (HMAC/JWT)

### Tarefas
- Criar/editar/deletar
- Import automático via link `.ics` (Toddle, Google Cal, Outlook)
- Status: pendente, concluída, cancelada
- Prazo com lembretes

### IA (Gemini 2.5 Flash)
- Chat agêntico: planeja → executa → relata
- Completa tarefas no estilo do usuário
- **Memórias com fotos** — sobe imagens de atividades e a IA vê no autoComplete + chat
- Gera flashcards, quizzes, resumos

### Integrações
- **Gmail SMTP**: lembretes por e-mail
- **Feed .ics**: Toddle, Google Calendar, Outlook
- **WhatsApp**: link `wa.me` pra lembrete

### Banco
- MySQL/TiDB via Drizzle ORM
- Migrações versionadas em `drizzle/`

## Desenvolvimento

```bash
pnpm test         # Vitest (416 testes)
pnpm check        # tsc --noEmit
pnpm build        # build de produção
```

## Deploy grátis no Render

Passo a passo completo em [COMO-PUBLICAR-DE-GRACA.md](./COMO-PUBLICAR-DE-GRACA.md). Resumo:

1. Fork/push do repo pro GitHub
2. Criar banco no [TiDB Cloud Serverless](https://tidbcloud.com) (grátis)
3. No Render, criar Web Service apontando pro repo
4. Configurar env vars no dashboard:
   - `DATABASE_URL`, `APP_PASSWORD`, `JWT_SECRET`, `GEMINI_API_KEY`
   - Opcional: `APP_PUBLIC_URL` (Render seta sozinho via `RENDER_EXTERNAL_URL`)
5. Deploy — o Dockerfile roda `drizzle-kit migrate` no boot

## API (tRPC)

Endpoints principais em `/api/trpc`:

- `auth.login` / `auth.me` / `auth.logout`
- `tasks.list` / `tasks.create` / `tasks.update` / `tasks.delete`
- `memories.list` / `memories.create` / `memories.update`
- `chat.message`
- `integrations.getSettings` / `integrations.updateSettings`
- `studyTools.generateFlashcards` / `.generateQuiz`
- `toddleSync.syncNow`

## Troubleshooting

### Gmail SMTP falhando
- Use uma [Senha de App](https://myaccount.google.com/apppasswords), não a senha comum
- Verifique se 2FA está ativo na conta Google

### Conexão com banco
- `DATABASE_URL` correto (usuário/senha/host)
- TiDB Cloud exige `?sslaccept=strict` no final
- Confira firewall/whitelist de IP

### Sync de calendário (.ics)
- Link precisa ser público (`webcal://` ou `.ics` terminando em URL http/https)
- Feed maior que 5MB é rejeitado
- Precisa começar com `BEGIN:VCALENDAR`

### IA não vê imagens de memórias
- Configure `APP_PUBLIC_URL` (ou deixe o Render setar `RENDER_EXTERNAL_URL` sozinho)
- Sem isso, o LLM só recebe path relativo `/uploads/foo.png` e ignora

## Licença

Projeto pessoal. Uso privado.
