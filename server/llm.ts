// Adaptador de IA independente do Manus. Substitui o invokeLLM do Forge
// (bloqueado com a conta Manus) por um provedor GRATUITO — Google Gemini
// (chave grátis, sem cartão). Mesma interface do _core/llm, então é um
// drop-in: os chamadores (chat, geração de flashcards/quiz/guia, cronograma,
// completar-tarefa) não mudam.
//
// Config (env):
//   GEMINI_API_KEY  — chave grátis do Google AI Studio (aistudio.google.com/apikey)
//   GEMINI_MODEL    — opcional, padrão "gemini-2.0-flash"
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

const GEMINI_KEY = process.env.GEMINI_API_KEY ?? "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

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

  const url = `${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;
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
  const outText = parts.map((p: any) => p?.text ?? "").join("");

  return {
    id: data?.responseId ?? "gemini",
    created: 0,
    model: GEMINI_MODEL,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: outText },
        finish_reason: data?.candidates?.[0]?.finishReason ?? "stop",
      },
    ],
  };
}

// Drop-in do invokeLLM. Prioriza Gemini (grátis); sem chave, tenta o Forge.
export async function invokeLLM(params: forge.InvokeParams): Promise<forge.InvokeResult> {
  if (GEMINI_KEY) {
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
