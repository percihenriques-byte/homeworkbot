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

## E o WhatsApp?

Enviar WhatsApp **automático** exige o gateway do próprio WhatsApp (Twilio/Meta), que é uma API
externa paga com conta aprovada — não dá pra "criar do zero" sem passar por eles. A alternativa
sem API já está no app: o botão **"Lembrete no WhatsApp"** em cada tarefa abre o WhatsApp com a
mensagem pronta (link `wa.me`) pra você tocar e enviar.
