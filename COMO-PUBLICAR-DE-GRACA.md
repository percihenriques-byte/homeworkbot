# Como publicar o Homework Assistant de graça (fora do Manus)

O app foi adaptado pra viver **sem o Manus**: a IA agora usa o **Google Gemini (grátis)**,
o login é **cadastro por e-mail + senha** (cada pessoa cria a própria conta), e ele roda em
qualquer host. São **3 cadastros grátis** (uma vez cada) e nenhum cartão de crédito.

Tempo total: ~20–30 minutos.

---

## Passo 1 — Chave da IA (Google Gemini) — grátis, 2 min

1. Entre em **https://aistudio.google.com/apikey** (faça login com sua conta Google).
2. Clique **"Create API key"** / "Criar chave de API".
3. Copie a chave (algo tipo `AIza...`). **Guarde** — vai colar no Passo 3.

> É grátis, sem cartão. O app usa o modelo **gemini-2.5-flash** (grátis: ~250 usos/dia, 10/min) —
> de sobra pro uso escolar. Se um dia quiser mais, dá pra trocar pra `gemini-2.5-flash-lite`
> (1000/dia) pondo `GEMINI_MODEL=gemini-2.5-flash-lite` nas variáveis do Render.

---

## Passo 2 — Banco de dados (TiDB Cloud) — grátis, 5 min

1. Entre em **https://tidbcloud.com** e crie uma conta (pode logar com Google/GitHub).
2. Crie um **cluster Starter** (é o novo nome do Serverless grátis — 25 GiB + 250M leituras/mês
   sem cartão). Região: escolha a mais perto (ex: Singapore).
3. Depois de criado, clique em **"Connect"**.
4. Em "Connect With", escolha **"General"**. Ele mostra os dados de conexão.
5. Monte a sua **DATABASE_URL** assim (troque pelos valores que aparecem):
   ```
   mysql://USUARIO:SENHA@HOST:4000/test?sslaccept=strict
   ```
   - USUARIO e HOST aparecem na tela; SENHA você define/copia ali.
   - O nome do banco pode ser `test` (o padrão do TiDB) — pode deixar assim.
6. **Guarde** essa URL inteira — vai colar no Passo 3.

---

## Passo 3 — Publicar no Render — grátis, 10 min

1. Entre em **https://render.com** e crie conta com o seu **GitHub** (o mesmo do repo `homeworkbot`).
2. Clique **"New +" → "Web Service"**.
3. Conecte/escolha o repositório **`percihenriques-byte/homeworkbot`**.
4. Configurações:
   - **Language/Environment:** Docker (ele detecta o `Dockerfile` sozinho).
   - **Instance Type:** Free.
5. Abra **"Advanced" / "Environment Variables"** e adicione estas 4 (uma por linha):

   | Nome | Valor |
   |---|---|
   | `DATABASE_URL` | (a URL do Passo 2) |
   | `GEMINI_API_KEY` | (a chave do Passo 1) |
   | `JWT_SECRET` | um texto aleatório longo (ex: aperte várias teclas) |

   *Se usar o botão "Deploy to Render" (Blueprint), esses 2 primeiros já vêm
   marcados como "sync: false" (você preenche no dashboard) e `JWT_SECRET`
   é gerado sozinho.*

6. Clique **"Create Web Service"**. O Render vai buildar (~5 min).
7. Quando terminar, ele te dá uma URL tipo **`https://homeworkbot.onrender.com`**. Esse é o seu site!

---

## Passo 4 — Criar conta e entrar

1. Abra a URL do seu site → clique **"Entrar"**.
2. Clique **"Criar conta"** (na tela de login).
3. Preencha **Nome**, **E-mail** e **Senha** (mínimo 6 caracteres) → **"Criar conta"**.
4. Você já entra direto no painel. Cada pessoa cria a própria conta — dados isolados.
5. Pronto. Tarefas, cronograma, flashcards e o **Jarvis** funcionando. 🎉

---

## Observações

- **Domínio próprio:** se quiser um domínio (ex: `tarefas.seunome.com`), o Render deixa adicionar
  um "Custom Domain" grátis nas configurações do serviço — é só apontar o DNS.
- **O site "dorme":** no plano grátis do Render, o site hiberna após ~15 min sem uso e demora
  uns 30–50s pra acordar no primeiro acesso. Normal.
- **Uploads de arquivo:** funcionam, mas o disco grátis é temporário — arquivos podem sumir num
  redeploy. Recurso secundário.
- **IA olhar imagens (memórias com foto):** o Render seta `RENDER_EXTERNAL_URL` sozinho, então
  o app monta URL absoluta pras imagens que envia ao LLM. Em outros hosts, defina
  `APP_PUBLIC_URL=https://seu-dominio` na Environment pra o mesmo efeito.
- **Lembretes automáticos por e-mail:** o disparo automático dependia do agendador do Manus. Fora
  dele, dá pra ligar um cron grátis externo (ex: **cron-job.org**) chamando, de hora em hora,
  `https://SEU-SITE/api/scheduled/send-reminders`. (Opcional — o resto funciona sem isso.)
- **Chaves antigas do Manus:** não precisam mais. Deixe `BUILT_IN_FORGE_*`, `OAUTH_*`, `VITE_APP_ID`
  em branco/ausentes.

Qualquer passo que travar, me chama que eu destravo. 🙌
