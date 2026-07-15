import nodemailer from "nodemailer";
import { escapeHtml, formatFrom } from "./utils/emailFormatting";

const DEFAULT_FROM = "noreply@homeworkassistant.com";

async function createGmailTransporter(gmailUser: string, gmailAppPassword: string) {
  if (!gmailUser || !gmailAppPassword) {
    throw new Error(
      "Gmail credentials not configured. Please add your Gmail and App Password in Settings."
    );
  }
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: gmailUser, pass: gmailAppPassword },
  });
}

// Fallback for local testing (nunca em produção com usuários reais).
async function getEtherealTransporter() {
  console.log("[Email] Creating Ethereal test account for email sending...");
  const testAccount = await nodemailer.createTestAccount();
  return nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });
}

async function selectTransporter(gmailUser?: string, gmailAppPassword?: string) {
  if (gmailUser && gmailAppPassword) {
    return {
      transport: await createGmailTransporter(gmailUser, gmailAppPassword),
      fromEmail: gmailUser,
      usingFallback: false,
    };
  }
  return {
    transport: await getEtherealTransporter(),
    fromEmail: DEFAULT_FROM,
    usingFallback: true,
  };
}

export async function sendTestEmail(
  toEmail: string,
  gmailUser?: string,
  gmailAppPassword?: string,
  senderName?: string | null
) {
  try {
    console.log("[Email] Sending test email to:", toEmail);
    const { transport, fromEmail, usingFallback } = await selectTransporter(
      gmailUser,
      gmailAppPassword
    );

    const info = await transport.sendMail({
      from: formatFrom(fromEmail, senderName),
      to: toEmail,
      subject: "Teste do Homework Assistant",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Bem-vindo ao Homework Assistant! 🎓</h2>
          <p>Seu assistente de tarefas está funcionando!</p>
          <p>Este é um email de teste para confirmar que o sistema de notificações está ativo.</p>
          <p>Você receberá emails como este quando:</p>
          <ul>
            <li>Tiver tarefas próximas do prazo</li>
            <li>Solicitar conclusão automática de trabalhos</li>
            <li>Receber lembretes de estudo</li>
          </ul>
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            Se você não configurou este email, ignore esta mensagem.
          </p>
        </div>
      `,
    });

    console.log("[Email] Test email sent successfully! Message ID:", info.messageId);

    if (usingFallback) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log("[Email] Preview URL:", previewUrl);
      return { success: true, messageId: info.messageId, previewUrl };
    }
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("[Email] Failed to send test email:", error);
    throw error;
  }
}

export async function sendReminderEmail(
  toEmail: string,
  taskTitle: string,
  dueDate: string,
  gmailUser?: string,
  gmailAppPassword?: string,
  senderName?: string | null
) {
  try {
    console.log("[Email] Sending reminder email to:", toEmail);
    const { transport, fromEmail } = await selectTransporter(gmailUser, gmailAppPassword);
    const safeTitle = escapeHtml(taskTitle);
    const safeDueDate = escapeHtml(dueDate);

    const info = await transport.sendMail({
      from: formatFrom(fromEmail, senderName),
      to: toEmail,
      subject: `Lembrete: ${taskTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Lembrete de Tarefa 📝</h2>
          <p>Você tem uma tarefa próxima do prazo:</p>
          <h3 style="color: #2563eb;">${safeTitle}</h3>
          <p><strong>Prazo:</strong> ${safeDueDate}</p>
          <p>Acesse o Homework Assistant para gerenciar suas tarefas.</p>
        </div>
      `,
    });

    console.log("[Email] Reminder email sent successfully!");
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("[Email] Failed to send reminder email:", error);
    throw error;
  }
}

export async function sendCompletedTaskEmail(
  toEmail: string,
  taskTitle: string,
  content: string,
  gmailUser?: string,
  gmailAppPassword?: string,
  senderName?: string | null
) {
  try {
    console.log("[Email] Sending completed task email to:", toEmail);
    const { transport, fromEmail } = await selectTransporter(gmailUser, gmailAppPassword);
    const safeTitle = escapeHtml(taskTitle);
    // Conteúdo é gerado pela IA em cima das memórias do usuário. Escapamos
    // antes de injetar pra evitar que qualquer tag/entidade do texto vire
    // markup real no email.
    const safeContent = escapeHtml(content);

    const info = await transport.sendMail({
      from: formatFrom(fromEmail, senderName),
      to: toEmail,
      subject: `Tarefa Concluída: ${taskTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Sua Tarefa Foi Concluída! ✅</h2>
          <h3 style="color: #2563eb;">${safeTitle}</h3>
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <pre style="white-space: pre-wrap; word-wrap: break-word; font-family: inherit;">${safeContent}</pre>
          </div>
          <p style="color: #666; font-size: 12px;">
            Este conteúdo foi gerado pelo Homework Assistant com base no seu estilo pessoal.
          </p>
        </div>
      `,
    });

    console.log("[Email] Completed task email sent successfully!");
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("[Email] Failed to send completed task email:", error);
    throw error;
  }
}
