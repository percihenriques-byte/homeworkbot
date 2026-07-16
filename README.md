# Homework Assistant

Assistente inteligente de tarefas escolares com IA, lembretes por email/WhatsApp, e personalização contínua.

## 🚀 Deploy grátis (1 clique)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/percihenriques-byte/homeworkbot)

Clica no botão, faz login com GitHub e o Render lê o `render.yaml` sozinho. Só precisa colar 3 valores no final:

- `APP_PASSWORD` — senha do site (você define)
- `DATABASE_URL` — string do TiDB Cloud ([tidbcloud.com](https://tidbcloud.com), grátis)
- `GEMINI_API_KEY` — chave da IA ([aistudio.google.com/apikey](https://aistudio.google.com/apikey), grátis)

Passo a passo completo em [SETUP_INSTRUCTIONS.md](./SETUP_INSTRUCTIONS.md) e [COMO-PUBLICAR-DE-GRACA.md](./COMO-PUBLICAR-DE-GRACA.md).

## Funcionalidades

- **Tarefas automáticas do Toddle** — sincroniza tarefas automaticamente
- **Chat com IA** — explica conceitos, resolve problemas, completa tarefas no seu estilo
- **Memórias** — alimenta a IA com conversas anteriores para personalização
- **Ferramentas de estudo** — flashcards, quizzes, resumos gerados por IA
- **Cronograma automático** — gera horários de estudo otimizados
- **Lembretes** — email (Gmail SMTP) e WhatsApp
- **Multi-usuário** — cada pessoa tem conta e dados independentes
- **Responsivo** — funciona no computador e celular

## Setup Rápido

```bash
# Instalar dependências
pnpm install

# Configurar variáveis de ambiente
cp .env.example .env.local
# Editar .env.local com suas credenciais

# Rodar em desenvolvimento
pnpm dev
```

## Variáveis de Ambiente Necessárias

```
DATABASE_URL=mysql://user:pass@host:port/database
OPENAI_API_KEY=sua-chave
SESSION_SECRET=uma-string-aleatoria
```

## Stack

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + tRPC
- **Banco**: MySQL + Drizzle ORM
- **IA**: OpenAI API
- **Email**: Nodemailer + Gmail SMTP

## Estrutura do Projeto

```
├── client/          # Frontend React
│   ├── src/
│   │   ├── pages/       # Páginas (Chat, Tasks, Memories, Settings, etc.)
│   │   ├── components/  # Componentes reutilizáveis
│   │   ├── hooks/       # Custom hooks
│   │   └── lib/         # Utilitários
├── server/          # Backend Node.js
│   ├── db.ts            # Funções do banco de dados
│   ├── email.ts         # Serviço de email
│   └── routers.ts       # Rotas tRPC
├── shared/          # Tipos compartilhados
├── drizzle/         # Schema e migrações do banco
└── INSTRUCOES_DO_PROJETO.md  # Instruções completas de como o app deve funcionar
```

## Instruções Detalhadas

Veja o arquivo `INSTRUCOES_DO_PROJETO.md` para todas as regras de negócio, comportamentos esperados, e especificações técnicas do projeto.
