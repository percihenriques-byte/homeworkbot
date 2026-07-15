// Monta URL wa.me (click-to-chat) do WhatsApp — usado no botão de lembrete
// de tarefa. Sem API paga: só abre o WhatsApp do usuário com a mensagem
// preenchida e ele envia manualmente.
//
// Formato oficial (docs do WhatsApp):
//   https://wa.me/<phone>?text=<url-encoded>
// Sem phone (envio genérico, pra escolher contato):
//   https://wa.me/?text=<url-encoded>
//
// Puro (sem I/O) — testável isoladamente.

export type WhatsappReminderInput = {
  phone?: string | null;
  title: string;
  subject?: string | null;
  dueDate?: Date | string | null;
};

/**
 * Devolve a URL wa.me pronta pra `window.open()`, com a mensagem já
 * URL-encoded. Se phone estiver vazio ou tiver dígitos insuficientes,
 * usa a versão sem número (o WhatsApp mostra seletor de contato).
 */
export function buildWhatsappReminderUrl(input: WhatsappReminderInput): string {
  const digits = String(input.phone ?? "").replace(/\D/g, "");
  const validPhone = digits.length >= 8 ? digits : "";
  const due = input.dueDate
    ? new Date(input.dueDate).toLocaleDateString("pt-BR")
    : "sem prazo";
  const msg =
    `📚 Lembrete de tarefa: ${input.title}` +
    (input.subject ? ` (${input.subject})` : "") +
    `\nPrazo: ${due}`;
  const query = `text=${encodeURIComponent(msg)}`;
  return validPhone
    ? `https://wa.me/${validPhone}?${query}`
    : `https://wa.me/?${query}`;
}
