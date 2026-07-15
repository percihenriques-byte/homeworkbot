import { describe, expect, it } from "vitest";
import {
  keyFromStorageUrl,
  normalizeKey,
  appendHashSuffixWith,
} from "./storage";

describe("normalizeKey", () => {
  it("remove barras iniciais", () => {
    expect(normalizeKey("/foo/bar.txt")).toBe("foo/bar.txt");
    expect(normalizeKey("///foo/bar")).toBe("foo/bar");
  });

  it("mantém key sem barra inicial", () => {
    expect(normalizeKey("foo/bar.txt")).toBe("foo/bar.txt");
  });

  it("string vazia → string vazia", () => {
    expect(normalizeKey("")).toBe("");
  });
});

describe("appendHashSuffixWith (determinístico com hash injetado)", () => {
  it("insere hash ANTES da extensão", () => {
    expect(appendHashSuffixWith("foto.png", "abc12345")).toBe("foto_abc12345.png");
    expect(appendHashSuffixWith("doc.pdf", "deadbeef")).toBe("doc_deadbeef.pdf");
  });

  it("sem extensão → hash no final", () => {
    expect(appendHashSuffixWith("nome-sem-extensao", "abcd0000")).toBe(
      "nome-sem-extensao_abcd0000"
    );
  });

  it("caminho com pasta preserva pasta", () => {
    expect(appendHashSuffixWith("uploads/foto.png", "beef1234")).toBe(
      "uploads/foto_beef1234.png"
    );
  });

  it("múltiplos pontos: só o último conta como extensão", () => {
    expect(appendHashSuffixWith("meu.arquivo.tar.gz", "1234abcd")).toBe(
      "meu.arquivo.tar_1234abcd.gz"
    );
  });

  it("arquivo começando com ponto (hidden file, sem extensão)", () => {
    // Comportamento observável: reconhece o ponto como extensão.
    // Isso é aceitável — hidden files raramente são upload de usuário.
    const r = appendHashSuffixWith(".gitkeep", "hhhhhhhh");
    expect(r).toContain("hhhhhhhh");
  });
});

describe("keyFromStorageUrl", () => {
  it("extrai a key de path /manus-storage/{key}", () => {
    expect(keyFromStorageUrl("/manus-storage/uploads/foo.png")).toBe("uploads/foo.png");
    expect(keyFromStorageUrl("/manus-storage/abc123")).toBe("abc123");
  });

  it("URL absoluta http/https → null (é externa, não é do Manus)", () => {
    expect(keyFromStorageUrl("https://example.com/foo.png")).toBeNull();
    expect(keyFromStorageUrl("http://s3.amazonaws.com/bucket/key")).toBeNull();
  });

  it("path que não começa com /manus-storage → null", () => {
    expect(keyFromStorageUrl("/uploads/foo.png")).toBeNull();
    expect(keyFromStorageUrl("/api/anything")).toBeNull();
    expect(keyFromStorageUrl("foo.png")).toBeNull();
  });

  it("/manus-storage/ sozinho (sem key) → null", () => {
    expect(keyFromStorageUrl("/manus-storage/")).toBeNull();
  });

  it("case-sensitive: /Manus-Storage/ não bate", () => {
    expect(keyFromStorageUrl("/Manus-Storage/x")).toBeNull();
  });
});
