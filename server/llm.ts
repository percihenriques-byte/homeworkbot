// Adaptador de IA independente do Manus. Substitui o invokeLLM do Forge
// (bloqueado com a conta Manus) por um provedor GRATUITO — Google Gemini
// (chave grátis, sem cartão). Mesma interface do _core/llm, então é um
// drop-in: os chamadores (chat, geração de flashcards/quiz/guia, cronograma,
// completar-tarefa) não mudam.
//
// Config (env):
//   GEMINI_API_KEY  — chave grátis do Google AI Studio (aistudio.google.com/apikey)
//   GEMINI_MODEL    — opcional, padrão "gemini-2.5-flash"
//
// Sem GEMINI_API_KEY, cai no Forge do Manus (compatibilidade — útil só se a
// conta voltar). Sem nenhum dos dois, lança erro claro.

import * as forge from "./_core/llm";

// Re-exporta os tipos (Message, InvokeParams, InvokeResult, etc) pra quem
// importava de _core/llm poder importar daqui.
export type {
  Role,
  TextContent,
  ImageContent,
  FileContent,
  MessageContent,
  Message,
  Tool,
  ToolChoice,
  InvokeParams,
  InvokeResult,
  ToolCall,
} from "./_core/llm";

// Lidos na hora da chamada (não no carregamento) — assim o env pode mudar e dá pra testar.
const geminiKey = () => process.env.GEMINI_API_KEY ?? "";
const geminiModel = () => process.env.GEMINI_MODEL || "gemini-2.5-flash";
// Endpoint da API. Override via GEMINI_BASE permite apontar pra um proxy
// compatível ou um mock (testes). Padrão: API oficial do Google.
const geminiBase = () => process.env.GEMINI_BASE || "https://generativelanguage.googleapis.com/v1beta/models";

// Converte um JSON Schema (nosso formato OpenAI) pro Schema do Gemini, que
// exige os tipos em MAIÚSCULO (STRING/OBJECT/...). Exportado pra testes.
export function toGeminiSchema(schema: any): any {
  if (!schema || typeof schema !== "object") return undefined;
  const typeMap: Record<string, string> = {
    string: "STRING",
    number: "NUMBER",
    integer: "INTEGER",
    boolean: "BOOLEAN",
    array: "ARRAY",
    object: "OBJECT",
  };
  const out: any = {};
  if (schema.type) out.type = typeMap[String(schema.type).toLowerCase()] ?? "STRING";
  if (schema.description) out.description = schema.description;
  if (Array.isArray(schema.enum)) out.enum = schema.enum;
  if (schema.properties && typeof schema.properties === "object") {
    out.properties = {};
    for (const [k, v] of Object.entries(schema.properties)) out.properties[k] = toGeminiSchema(v);
    if (Array.isArray(schema.required) && schema.required.length) out.required = schema.required;
  }
  if (schema.items) out.items = toGeminiSchema(schema.items);
  return out;
}

// Converte tools estilo OpenAI ({type:"function", function:{name,description,parameters}})
// pro formato do Gemini ({functionDeclarations:[...]}). Exportado pra testes.
export function toGeminiTools(tools: any[]): any[] {
  const decls = tools
    .filter((t) => t?.type === "function" && t.function?.name)
    .map((t) => {
      const d: any = { name: t.function.name };
      if (t.function.description) d.description = t.function.description;
      const params = toGeminiSchema(t.function.parameters);
      // Gemini rejeita OBJECT sem properties; omite parameters nesse caso.
      if (params && params.type === "OBJECT" && params.properties && Object.keys(params.properties).length) {
        d.parameters = params;
      }
      return d;
    });
  return decls.length ? [{ functionDeclarations: decls }] : [];
}

function extractText(content: any): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((p: any) => {
        if (typeof p === "string") return p;
        if (p?.type === "text") return p.text ?? "";
        if (p?.type === "image_url") return "\n[o usuário anexou uma imagem]";
        if (p?.type === "file_url") return "\n[o usuário anexou um arquivo]";
        return "";
      })
      .join("");
  }
  return "";
}

async function invokeGemini(params: forge.InvokeParams): Promise<forge.InvokeResult> {
  const contents: any[] = [];
  let systemInstruction: { parts: { text: string }[] } | undefined;

  for (const m of params.messages) {
    const text = extractText(m.content);
    if (m.role === "system") {
      // Gemini junta tudo num systemInstruction. Concatena se houver mais de um.
      systemInstruction = systemInstruction
        ? { parts: [{ text: `${systemInstruction.parts[0].text}\n\n${text}` }] }
        : { parts: [{ text }] };
      continue;
    }
    // Gemini usa "user" e "model" (não "assistant"). Roles tool/function viram user.
    const role = m.role === "assistant" ? "model" : "user";
    contents.push({ role, parts: [{ text }] });
  }

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens: (params as any).max_tokens ?? params.maxTokens ?? 2048,
      temperature: 0.7,
    },
  };
  if (systemInstruction) body.systemInstruction = systemInstruction;

  // Function calling: se vierem tools, manda as declarações pro Gemini e liga
  // o modo (AUTO = o modelo decide; ANY = obriga chamar; NONE = nunca).
  const tools = (params as any).tools;
  if (Array.isArray(tools) && tools.length) {
    const geminiTools = toGeminiTools(tools);
    if (geminiTools.length) {
      body.tools = geminiTools;
      const tc = (params as any).toolChoice ?? (params as any).tool_choice;
      const mode = tc === "required" ? "ANY" : tc === "none" ? "NONE" : "AUTO";
      body.toolConfig = { functionCallingConfig: { mode } };
    }
  }

  const url = `${geminiBase()}/${geminiModel()}:generateContent?key=${geminiKey()}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => resp.statusText);
    throw new Error(`Gemini falhou (${resp.status}): ${errText}`);
  }

  const data: any = await resp.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];

  // Separa texto de chamadas de função (functionCall) e converte estas pro
  // formato tool_calls estilo OpenAI, que é o que o chat.message já entende.
  let outText = "";
  const toolCalls: any[] = [];
  for (const p of parts) {
    if (typeof p?.text === "string") outText += p.text;
    if (p?.functionCall?.name) {
      toolCalls.push({
        id: `call_${toolCalls.length}`,
        type: "function",
        function: {
          name: p.functionCall.name,
          arguments: JSON.stringify(p.functionCall.args ?? {}),
        },
      });
    }
  }

  const message: any = { role: "assistant", content: outText };
  if (toolCalls.length) message.tool_calls = toolCalls;

  return {
    id: data?.responseId ?? "gemini",
    created: 0,
    model: geminiModel(),
    choices: [
      {
        index: 0,
        message,
        finish_reason: data?.candidates?.[0]?.finishReason ?? "stop",
      },
    ],
  };
}

// Drop-in do invokeLLM. Prioriza Gemini (grátis); sem chave, tenta o Forge.
export async function invokeLLM(params: forge.InvokeParams): Promise<forge.InvokeResult> {
  if (geminiKey()) {
    return invokeGemini(params);
  }
  // Compat: se ainda houver Forge configurado (conta Manus viva), usa ele.
  if (process.env.BUILT_IN_FORGE_API_KEY) {
    return forge.invokeLLM(params);
  }
  throw new Error(
    "IA não configurada: defina GEMINI_API_KEY (chave grátis em aistudio.google.com/apikey)."
  );
}
