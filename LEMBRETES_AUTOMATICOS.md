# Lembretes automáticos por e-mail — como ativar

O envio automático de lembretes **já está todo implementado no código**. Ele usa:

- **Gmail SMTP** (o mesmo que você configura em Configurações → Integrações) para enviar. **Nenhuma API externa paga.**
- **Cron da própria plataforma Manus** (Heartbeat) para disparar de tempos em tempos.

## Como funciona (automático, sem você fazer nada no dia a dia)

1. Toda tarefa com **prazo (data de entrega)** agenda sozinha um lembrete para **24h antes** do prazo.
2. Um cron roda a cada 15 min, vê quais lembretes venceram e **envia o e-mail** para você.
3. Se a tarefa for concluída ou apagada antes, o lembrete é cancelado automaticamente.

Requisitos por usuário: ter **Gmail + Senha de App** salvos em Configurações. Sem isso, não há como enviar (o app não inventa credencial).

## Ativação (UMA vez, depois de publicar o app)

O cron só pode ser criado **depois que o app estiver publicado (Deploy)** — o servidor de cron precisa da URL de produção. E deve ser criado **uma única vez** (é um cron do projeto inteiro, não por usuário).

### Passo a passo

1. **Publique o app** (Deploy) normalmente pelo painel do Manus.
2. Abra um terminal do Manus (sandbox) e rode **uma vez**:

   ```bash
   manus-heartbeat create \
     --name send-reminders \
     --cron "0 */15 * * * *" \
     --path /api/scheduled/send-reminders \
     --description "Envio automatico de lembretes de tarefas por email"
   ```

   - `"0 */15 * * * *"` = a cada 15 minutos (formato de 6 campos: seg min hora dia mês dia-semana, em UTC).
   - Guarde o `task_uid` que aparecer, caso um dia queira pausar/editar.

3. Pronto. Para conferir/pausar/ver logs depois:
   ```bash
   manus-heartbeat list
   manus-heartbeat logs --task-uid <uid>
   manus-heartbeat update --task-uid <uid> --enable=false   # pausar
   manus-heartbeat update --task-uid <uid> --enable=true    # retomar
   ```

Você também vê e gerencia esse cron no painel do Manus (execuções, pausar/retomar, "Run Now", Investigate).

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

### Ativar o cron de sync (uma vez, após o Deploy)
Assim como os lembretes, o cron só existe depois do Deploy. Rode **uma vez** no terminal Manus:

```bash
manus-heartbeat create \
  --name sync-toddle \
  --cron "0 0 */4 * * *" \
  --path /api/scheduled/sync-toddle \
  --description "Busca automatica de tarefas do Toddle (feed .ics)"
```

- `"0 0 */4 * * *"` = a cada 4 horas. Ajuste se quiser mais/menos frequente.
- O manual também funciona: botão **"Sincronizar"** na página Tarefas puxa na hora.

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
