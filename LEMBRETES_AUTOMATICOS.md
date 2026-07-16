# Lembretes automáticos por e-mail — como ativar

O envio automático de lembretes **já está todo implementado no código**. Ele usa:

- **Gmail SMTP** (o mesmo que você configura em Configurações → Integrações) para enviar. **Nenhuma API externa paga.**
- **Cron externo** (cron-job.org, GitHub Actions, EasyCron etc.) para disparar de tempos em tempos.

## Como funciona (automático, sem você fazer nada no dia a dia)

1. Toda tarefa com **prazo (data de entrega)** agenda sozinha um lembrete para **24h antes** do prazo.
2. Um cron externo bate no endpoint a cada 15 min, o servidor vê quais lembretes venceram e **envia o e-mail** para você.
3. Se a tarefa for concluída ou apagada antes, o lembrete é cancelado automaticamente.

Requisitos por usuário: ter **Gmail + Senha de App** salvos em Configurações. Sem isso, não há como enviar (o app não inventa credencial).

## Ativação (uma vez, depois do Deploy)

O cron só faz sentido **depois que o app estiver publicado** — o serviço de cron precisa da URL pública.

### Configurar cron externo (grátis)

Use um serviço gratuito de cron. Sugestão: [cron-job.org](https://cron-job.org).

Endpoint a ser chamado:

```
POST https://<seu-app>.onrender.com/api/scheduled/send-reminders
```

Header de autenticação:

```
x-cron-secret: <valor de CRON_SECRET no .env>
```

Frequência: a cada **15 minutos**.

Defina `CRON_SECRET` nas env vars do Render com um texto longo e aleatório. Só chamadas com esse header passam — protege o endpoint de spam.

### Alternativa: GitHub Actions

Crie `.github/workflows/reminders.yml`:

```yaml
name: send-reminders
on:
  schedule:
    - cron: "*/15 * * * *"
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -X POST \
            -H "x-cron-secret: ${{ secrets.CRON_SECRET }}" \
            https://<seu-app>.onrender.com/api/scheduled/send-reminders
```

Guarde `CRON_SECRET` em Settings → Secrets do GitHub.

## Onde está o código (pra referência)

- `server/reminders.ts` — agenda (`syncTaskReminder`), envia (`sendDueReminders`) e a rota `/api/scheduled/send-reminders`.
- `server/email.ts` — `sendReminderEmail` (Gmail SMTP).
- `server/_core/index.ts` — monta a rota do cron.
- Tarefas com prazo agendam lembrete em `tasks.create` / `tasks.update` / import `.ics`.

## Sincronização automática do Toddle (buscar tarefas sozinho)

O app busca as tarefas do Toddle sozinho, sem você fazer nada — a partir de um **link de calendário**.

### Configuração (uma vez)
1. No Toddle (ou Google/Outlook Calendar), copie o **link de assinatura do calendário** (procure "Assinar", "Subscribe", "iCal" ou ".ics").
2. No app: **Configurações → Toddle → "Link do calendário (.ics)"**, cole o link e salve.
3. (Opcional) Ligue **"Fazer as tarefas e me enviar por e-mail"** — aí cada tarefa nova é feita pela IA no seu estilo e enviada pro seu Gmail. Precisa do Gmail configurado.

### Ativar cron de sync (junto com o de lembretes)

Configure um segundo job no seu cron externo:

```
POST https://<seu-app>.onrender.com/api/scheduled/sync-toddle
Header: x-cron-secret: <CRON_SECRET>
Frequência: a cada 4 horas
```

O manual também funciona: botão **"Sincronizar"** na página Tarefas puxa na hora.

### Como funciona por dentro
- `server/toddleSync.ts` — busca o link (`isSafeFeedUrl` bloqueia SSRF), parseia com `parseIcs`, deduplica por (título+dia), cria as tarefas e (se ligado) chama `completeAndEmailTask`.
- `server/autoComplete.ts` — completa no estilo do usuário (memórias) e envia por e-mail.
- Teto de 8 auto-completadas por execução (protege o timeout de 2 min do cron).
- O link fica guardado em `integrationSettings.toddleApiKey` (reusa coluna existente — sem migração).

## E o WhatsApp?

Enviar WhatsApp **automático** exige o gateway do próprio WhatsApp (Twilio/Meta), que é uma API
externa paga com conta aprovada — não dá pra "criar do zero" sem passar por eles. A alternativa
sem API já está no app: o botão **"Lembrete no WhatsApp"** em cada tarefa abre o WhatsApp com a
mensagem pronta (link `wa.me`) pra você tocar e enviar.
