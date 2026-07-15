// Helpers de formatação de e-mail extraídos do email.ts. Aqui só o que
// é puro (sem I/O nem nodemailer) — pra ficar testável sem mockar SMTP.

/**
 * Escapa string pra HTML. Usado nos templates HTML dos e-mails, pois
 * títulos de tarefa, conteúdo gerado pela IA, etc, chegam do usuário e
 * podem ter `<`, `>`, `&`, `"`, `'`.
 */
export function escapeHtml(input: string): string {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Monta o header From com nome amigável (RFC 5322):
 *   formatFrom("a@b.com", "João")  → `"João" <a@b.com>`
 *   formatFrom("a@b.com")          → `a@b.com`
 * Nome é sanitizado — aspas duplas, colchetes angulares e quebras de
 * linha são removidos (impedem header injection).
 */
export function formatFrom(email: string, name?: string | null): string {
  if (!name || !name.trim()) return email;
  const safeName = name
    .replace(/["<>\r\n]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!safeName) return email;
  return `"${safeName}" <${email}>`;
}
