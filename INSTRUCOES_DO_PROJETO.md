# Homework Assistant — Instruções Completas do Projeto

## Visão Geral

O Homework Assistant é um assistente inteligente de tarefas escolares que funciona 100% via navegador (computador e celular), permite múltiplos usuários independentes, e opera sem nenhuma API externa visível ao usuário.

---

## Princípios Fundamentais

1. **Zero configuração técnica para o usuário** — Nenhum campo de API key, token, ou configuração técnica deve ser visível. O app deve ser plug-and-play.
2. **Multi-usuário com dados isolados** — Cada pessoa cria sua conta e tem dados, configurações, memórias e personalização completamente independentes.
3. **Compartilhável** — Qualquer pessoa com o link pode acessar, criar conta e usar.
4. **Responsivo** — Funciona perfeitamente em computador e celular (mobile-first).
5. **Personalização contínua** — A IA aprende o estilo de cada usuário e melhora com o tempo.

---

## Funcionalidades Obrigatórias

### 1. Autenticação
- Cadastro e login com email/senha
- Cada conta é independente com dados isolados
- Sessão persistente (não deslogar a cada visita)

### 2. Tarefas (Integração com Toddle)
- As tarefas devem ser puxadas AUTOMATICAMENTE do Toddle usando as credenciais do usuário
- O usuário NÃO cria tarefas manualmente (isso é secundário)
- Fluxo principal: usuário conecta Toddle → app sincroniza tarefas automaticamente
- Mostrar status de conexão (conectado/desconectado)
- Botão "Sincronizar" para forçar atualização
- Priorização automática por data de entrega e importância

### 3. Chat com IA (Assistente Principal)
- Conversa com IA que:
  - Explica conceitos
  - Resolve problemas passo a passo
  - Cria resumos
  - **COMPLETA as tarefas do usuário imitando seu estilo de escrita**
- Memória de conversas (lembra do contexto anterior)
- Multilíngue (responde no idioma que o usuário usar)
- Usa as "Memórias" alimentadas pelo usuário para personalizar o tom e estilo

### 4. Memórias (Personalização da IA)
- Seção dedicada onde o usuário cola/importa conversas de outros chats (ChatGPT, Claude, Gemini, etc.)
- Categorização por rótulos (ex: "Meu estilo de escrita", "Preferências", "Tom de voz")
- A IA usa essas memórias como contexto para:
  - Imitar o estilo de escrita do usuário
  - Adaptar tom e abordagem
  - Personalizar respostas
- Cada usuário tem sua IA individual e personalizada

### 5. Ferramentas de Estudo
- Flashcards gerados por IA
- Quizzes personalizados
- Guias de estudo
- Resumos automáticos

### 6. Cronograma de Estudos
- Geração automática de cronograma baseado nas tarefas e prazos
- Otimização de horários
- Sugestões de quando estudar cada matéria

### 7. Lembretes
- **Email**: Envio automático de tarefas concluídas e lembretes de prazos
- **WhatsApp**: Lembretes de prazos próximos
- O usuário só configura: email de destino e número de WhatsApp

### 8. Configurações / Integrações
O usuário configura APENAS dados simples (sem nada técnico):

#### Email (Gmail SMTP)
- Campo: Email do Gmail
- Campo: Senha de App do Google
- Texto de ajuda: "Gere sua senha de app em myaccount.google.com > Segurança > Senhas de app"
- Botão: "Enviar Email de Teste"

#### WhatsApp
- Campo: Número de WhatsApp (com código do país)

#### Toddle/Nordcraft
- Dropdown: Tipo de login (Lex Brasil, Toddle Direct, Google, Microsoft, Outro)
- Campo: Usuário (aceita username OU email)
- Campo: Senha

#### Estilo da IA
- Configurações de como a IA deve responder (formal/informal, detalhado/resumido, etc.)

---

## Comportamento da IA ao Completar Tarefas

Quando o usuário pede para a IA completar uma tarefa:

1. A IA consulta as "Memórias" do usuário para entender seu estilo
2. Completa a tarefa imitando a forma de escrever do usuário
3. Apresenta o resultado no chat
4. Oferece opção de enviar por email automaticamente
5. O resultado deve parecer que FOI ESCRITO PELO PRÓPRIO USUÁRIO

---

## Arquitetura Técnica

### Frontend
- React com TypeScript
- Tailwind CSS para estilização
- Tema escuro (cyberpunk/neon)
- Responsivo mobile-first
- Sidebar colapsável em mobile (hamburger menu)

### Backend
- Node.js com Express
- tRPC para API type-safe
- Drizzle ORM para banco de dados

### Banco de Dados
- MySQL
- Tabelas principais:
  - users (autenticação)
  - tasks (tarefas sincronizadas)
  - memories (memórias para personalização)
  - chat_messages (histórico de conversas)
  - integration_settings (configurações por usuário)
  - user_preferences (preferências e estilo IA)
  - flashcards, quizzes, study_schedules

### Email
- Nodemailer com Gmail SMTP
- Cada usuário usa seu próprio Gmail + Senha de App
- Porta 465, secure: true

### IA
- OpenAI API (embutida no servidor, invisível ao usuário)
- Contexto inclui até 5 memórias recentes do usuário
- System prompt personalizado com estilo do usuário

---

## Regras de UI/UX

1. **Inputs nunca devem perder foco** — Não usar forceMount, não causar re-renders que destroem inputs
2. **Abas devem permanecer abertas** — Ao clicar em uma aba, ela fica aberta até o usuário trocar
3. **Dados devem persistir** — Ao salvar configurações e recarregar a página, os dados devem aparecer preenchidos
4. **Feedback visual** — Toast notifications para sucesso/erro em todas as ações
5. **Mobile-first** — Tudo deve funcionar bem em telas de 375px de largura
6. **Sem scroll horizontal** — Nunca
7. **Botões grandes em mobile** — Mínimo 44px de altura para toque

---

## Fluxo do Usuário (Primeiro Uso)

1. Acessa o link → Vê landing page
2. Cria conta (email + senha)
3. É direcionado ao Dashboard
4. Vai em Configurações:
   - Conecta Toddle (tipo de login + usuário + senha)
   - Configura Gmail (email + senha de app)
   - Coloca número de WhatsApp
5. Volta ao Dashboard → Tarefas sincronizadas do Toddle aparecem
6. Vai em Memórias → Cola conversas anteriores para a IA aprender seu estilo
7. Usa o Chat para pedir ajuda ou completar tarefas
8. Recebe lembretes por email/WhatsApp

---

## O Que NÃO Deve Existir

- Campos de API key visíveis ao usuário
- Configuração de SMTP (host, porta, etc.) visível
- Necessidade de conhecimento técnico para usar
- Dados de um usuário visíveis para outro
- Criação manual de tarefas como fluxo principal (é secundário)

---

## Notas para Desenvolvimento

- Sempre que adicionar novas colunas ao schema, verificar se existem no banco com ALTER TABLE
- Testar salvamento de dados ANTES de fazer deploy
- Usar try-catch com logging em todas as operações de banco
- Manter compatibilidade mobile em todas as alterações de UI
