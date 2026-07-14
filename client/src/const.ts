export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Login do app. Fora do Manus, usamos a página de senha simples (/login).
// (Antes redirecionava pro portal OAuth do Manus, que foi bloqueado.)
export const getLoginUrl = () => "/login";
