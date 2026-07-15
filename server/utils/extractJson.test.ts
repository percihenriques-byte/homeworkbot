import { describe, expect, it } from "vitest";
import { extractJson } from "./extractJson";

describe("extractJson", () => {
  describe("caminho 1: JSON puro", () => {
    it("parseia objeto puro", () => {
      expect(extractJson<{ a: number }>('{"a": 1}')).toEqual({ a: 1 });
    });

    it("parseia array puro", () => {
      expect(extractJson<number[]>("[1, 2, 3]")).toEqual([1, 2, 3]);
    });

    it("parseia objeto aninhado", () => {
      expect(extractJson('{"a": {"b": [1, 2]}}')).toEqual({ a: { b: [1, 2] } });
    });
  });

  describe("caminho 2: fenced code block", () => {
    it("parseia dentro de ```json ... ```", () => {
      const raw = '```json\n{"a": 1}\n```';
      expect(extractJson(raw)).toEqual({ a: 1 });
    });

    it("parseia dentro de ``` ... ``` sem lang", () => {
      const raw = '```\n[1, 2, 3]\n```';
      expect(extractJson<number[]>(raw)).toEqual([1, 2, 3]);
    });

    it("parseia com texto antes e depois da fence", () => {
      const raw = 'Aqui está sua resposta:\n\n```json\n{"questions": [{"q": "?"}]}\n```\n\nEspero ter ajudado!';
      expect(extractJson<{ questions: { q: string }[] }>(raw)).toEqual({
        questions: [{ q: "?" }],
      });
    });
  });

  describe("caminho 3: JSON balanceado no meio de texto", () => {
    it("encontra objeto no meio de prosa", () => {
      const raw = 'Claro! Aqui está: {"a": 1, "b": 2} — espero que ajude.';
      expect(extractJson<{ a: number; b: number }>(raw)).toEqual({ a: 1, b: 2 });
    });

    it("encontra array no meio de prosa", () => {
      const raw = 'A resposta é [1, 2, 3] baseada nos dados.';
      expect(extractJson<number[]>(raw)).toEqual([1, 2, 3]);
    });

    it("respeita profundidade em objeto aninhado", () => {
      const raw = 'Antes {"a": {"b": {"c": 1}}} depois';
      expect(extractJson(raw)).toEqual({ a: { b: { c: 1 } } });
    });

    it("prefere o primeiro que aparece (array antes de objeto)", () => {
      const raw = '[1] {"a": 2}';
      expect(extractJson(raw)).toEqual([1]);
    });

    it("ignora chave/colchete DENTRO de string JSON (bug fix)", () => {
      // Antes do fix: o `}` dentro de "closing }" derrubava o contador
      // pra zero cedo demais, o JSON.parse do prefixo inválido dava throw,
      // e a função retornava null.
      const raw = 'Resposta: {"note": "closing brace }"} — fim.';
      expect(extractJson(raw)).toEqual({ note: "closing brace }" });
    });

    it("ignora colchetes dentro de strings", () => {
      const raw = 'Aqui: {"expr": "arr[0] + arr[1]"} depois.';
      expect(extractJson(raw)).toEqual({ expr: "arr[0] + arr[1]" });
    });

    it("aspas escapadas dentro de string não terminam a string", () => {
      const raw = 'A: {"quote": "ele disse \\"oi\\" e saiu"} B.';
      expect(extractJson(raw)).toEqual({ quote: 'ele disse "oi" e saiu' });
    });

    it("string com múltiplas chaves internas", () => {
      const raw = '{"a": "{{{}}}"}';
      expect(extractJson(raw)).toEqual({ a: "{{{}}}" });
    });

    it("array com string contendo colchete de fechamento", () => {
      const raw = 'Prosa [{"txt": "]"}, {"txt": "["}] fim';
      expect(extractJson(raw)).toEqual([{ txt: "]" }, { txt: "[" }]);
    });
  });

  describe("casos de falha e edge", () => {
    it("retorna null pra string vazia", () => {
      expect(extractJson("")).toBeNull();
    });

    it("retorna null pra null / undefined", () => {
      expect(extractJson(null)).toBeNull();
      expect(extractJson(undefined)).toBeNull();
    });

    it("retorna null quando não há JSON válido", () => {
      expect(extractJson("nada de json aqui, só texto")).toBeNull();
    });

    it("retorna null pra fence com conteúdo inválido", () => {
      const raw = '```json\nisso não é json de verdade\n```';
      expect(extractJson(raw)).toBeNull();
    });

    it("nunca lança pra qualquer input", () => {
      expect(() => extractJson({ crazy: "input" })).not.toThrow();
      expect(() => extractJson(12345)).not.toThrow();
      expect(() => extractJson(new Date())).not.toThrow();
    });
  });

  describe("aceita input array (chat response.choices[].message.content estilo)", () => {
    it("junta strings do array", () => {
      const raw = ["{", '"a": 1', "}"];
      expect(extractJson(raw)).toEqual({ a: 1 });
    });

    it("extrai campo .text dos objetos do array", () => {
      const raw = [{ text: '{"a":' }, { text: " 1}" }];
      expect(extractJson(raw)).toEqual({ a: 1 });
    });
  });
});
