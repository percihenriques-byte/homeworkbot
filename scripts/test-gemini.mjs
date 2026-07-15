// Teste AO VIVO da IA (Gemini) — prova que o Jarvis responde de verdade com a
// sua chave grátis, e valida o formato da requisição (inclusive function
// calling) contra a API REAL do Google. Não precisa de banco.
//
// Uso (PowerShell), com a chave já no ambiente:
//   node scripts/test-gemini.mjs

const KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

if (!KEY) {
  console.error("❌ GEMINI_API_KEY não está definida no ambiente.");
  process.exit(1);
}

async function call(body) {
  const res = await fetch(`${BASE}/${MODEL}:generateContent?key=${KEY}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => res.statusText);
    throw new Error(`Gemini ${res.status}: ${t}`);
  }
  return res.json();
}

// 1) Chat simples
async function testeChat() {
  const data = await call({
    systemInstruction: { parts: [{ text: "Você é o Jarvis, assistente de estudos. Responda em 1 frase curta, em PT-BR." }] },
    contents: [{ role: "user", parts: [{ text: "Me dê uma dica rápida pra estudar matemática." }] }],
    generationConfig: { maxOutputTokens: 200 },
  });
  const txt = data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  console.log("🟢 CHAT — o Jarvis respondeu:\n   " + (txt.trim() || "(vazio)"));
}

// 2) Function calling (ação agêntica): o Jarvis deve pedir pra criar uma tarefa
async function testeFunctionCalling() {
  const data = await call({
    contents: [{ role: "user", parts: [{ text: "Cria uma tarefa: prova de história na sexta." }] }],
    tools: [
      {
        functionDeclarations: [
          {
            name: "criar_tarefa",
            description: "Cria uma tarefa escolar do usuário.",
            parameters: {
              type: "OBJECT",
              properties: {
                title: { type: "STRING", description: "Título da tarefa" },
                dueDate: { type: "STRING", description: "Prazo AAAA-MM-DD" },
              },
              required: ["title"],
            },
          },
        ],
      },
    ],
    toolConfig: { functionCallingConfig: { mode: "AUTO" } },
  });
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const fc = parts.find((p) => p.functionCall)?.functionCall;
  if (fc) {
    console.log("🟢 AÇÃO AGÊNTICA — o Jarvis decidiu chamar a ferramenta:");
    console.log("   função: " + fc.name);
    console.log("   argumentos: " + JSON.stringify(fc.args));
  } else {
    const txt = parts.map((p) => p.text ?? "").join("");
    console.log("🟡 AÇÃO AGÊNTICA — não chamou função desta vez. Texto: " + txt.slice(0, 120));
  }
}

console.log(`Testando Gemini (modelo: ${MODEL})...\n`);
await testeChat();
console.log("");
await testeFunctionCalling();
console.log("\n✅ Se você viu respostas acima, a IA está funcionando de verdade com a sua chave.");
