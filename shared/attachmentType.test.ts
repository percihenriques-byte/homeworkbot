import { describe, expect, it } from "vitest";
import { inferAttachmentType } from "./attachmentType";

describe("inferAttachmentType", () => {
  it("image/*", () => {
    expect(inferAttachmentType("image/png")).toBe("image");
    expect(inferAttachmentType("image/jpeg")).toBe("image");
    expect(inferAttachmentType("image/webp")).toBe("image");
    expect(inferAttachmentType("image/svg+xml")).toBe("image");
  });

  it("audio/*", () => {
    expect(inferAttachmentType("audio/ogg")).toBe("audio");
    expect(inferAttachmentType("audio/mpeg")).toBe("audio");
    expect(inferAttachmentType("audio/wav")).toBe("audio");
    expect(inferAttachmentType("audio/webm")).toBe("audio");
  });

  it("PDFs viram document", () => {
    expect(inferAttachmentType("application/pdf")).toBe("document");
  });

  it("Word/DOCX vira document", () => {
    expect(inferAttachmentType(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )).toBe("document");
  });

  it("text/plain vira document (não image, não audio)", () => {
    expect(inferAttachmentType("text/plain")).toBe("document");
  });

  it("video/* vira document (não suportado como categoria própria)", () => {
    expect(inferAttachmentType("video/mp4")).toBe("document");
  });

  it("mime vazio → document (default seguro)", () => {
    expect(inferAttachmentType("")).toBe("document");
    expect(inferAttachmentType("   ")).toBe("document");
  });

  it("null / undefined / não-string → document (nunca joga)", () => {
    expect(inferAttachmentType(null)).toBe("document");
    expect(inferAttachmentType(undefined)).toBe("document");
    expect(inferAttachmentType(42 as any)).toBe("document");
  });

  it("é case-insensitive", () => {
    expect(inferAttachmentType("IMAGE/PNG")).toBe("image");
    expect(inferAttachmentType("Audio/OGG")).toBe("audio");
  });

  it("espaços em volta são tolerados", () => {
    expect(inferAttachmentType("  image/png  ")).toBe("image");
  });
});
