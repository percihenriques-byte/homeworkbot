/**
 * Traduz erros conhecidos do nodemailer/Gmail SMTP em mensagens
 * amigáveis em pt-BR. Usado em qualquer handler que dispare email
 * pra evitar vazar stacktraces indecifráveis pro usuário final.
 */
export function friendlyEmailError(error: unknown): string {
  const raw = String((error as any)?.message ?? "");
  if (raw.includes("Invalid login") || raw.includes("BadCredentials")) {
    return "Credenciais do Gmail inválidas. Verifique se você está usando uma Senha de App gerada em myaccount.google.com > Segurança.";
  }
  if (raw.includes("Missing credentials")) {
    return "Faltam email ou senha do Gmail. Preencha ambos em Configurações.";
  }
  if (raw.includes("ETIMEDOUT") || raw.includes("timeout")) {
    return "Tempo esgotado ao conectar no servidor do Gmail. Tente novamente.";
  }
  if (raw.includes("ECONNREFUSED")) {
    return "Conexão recusada pelo servidor. Verifique sua internet.";
  }
  return "Erro ao enviar email. Verifique as credenciais e tente novamente.";
}
