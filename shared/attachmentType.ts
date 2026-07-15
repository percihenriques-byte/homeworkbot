// Classifica um mime type de arquivo em uma das 3 categorias que o
// backend do chat aceita: image, audio, document. Usado no upload:
// determina como o LLM (multimodal) vai enxergar o arquivo.

export type AttachmentKind = "image" | "audio" | "document";

/**
 * Devolve a categoria do anexo pra um dado mime type.
 *   image/png, image/jpeg, image/webp → "image"
 *   audio/ogg, audio/mpeg, audio/wav  → "audio"
 *   qualquer outro (pdf, docx, etc)   → "document"
 *
 * Mime vazio ou não-string → "document" (default seguro pro pipeline).
 */
export function inferAttachmentType(mime: string | null | undefined): AttachmentKind {
  const m = typeof mime === "string" ? mime.toLowerCase().trim() : "";
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("audio/")) return "audio";
  return "document";
}
