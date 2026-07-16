// "IA de demonstração" — responde no formato do Gemini pra o Jarvis funcionar
// no modo demo SEM precisar de chave real. Não é IA de verdade; é só pra
// mostrar o fluxo. Com a GEMINI_API_KEY real, o app usa o Gemini de verdade.
import http from "http";

const RESP =
  "Claro! Aqui vai uma versão pronta, escrita de um jeito direto e com um exemplo do dia a dia, " +
  "no estilo das suas memórias. (Esta é a IA de demonstração — quando você configurar a chave " +
  "grátis do Google Gemini, as respostas passam a ser reais e específicas de cada tarefa.)";

const PORT = Number(process.env.DEMO_AI_PORT || 5005);
http
  .createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: RESP }] }, finishReason: "STOP" }] }));
    });
  })
  .listen(PORT, "127.0.0.1", () => console.log(`[demo-ai] http://127.0.0.1:${PORT}`));
