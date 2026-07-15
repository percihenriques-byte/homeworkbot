import { describe, expect, it } from "vitest";
import { classifyFeedUrl } from "./toddleFeedUrl";

describe("classifyFeedUrl", () => {
  it("string vazia → 'empty'", () => {
    const r = classifyFeedUrl("");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("empty");
  });

  it("apenas espaços → 'empty'", () => {
    const r = classifyFeedUrl("   \t\n");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("empty");
  });

  it("null/undefined → 'empty' (não crasha)", () => {
    expect(classifyFeedUrl(null).ok).toBe(false);
    expect(classifyFeedUrl(undefined).ok).toBe(false);
  });

  it("texto solto → 'not-url'", () => {
    const r = classifyFeedUrl("meu calendario");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("not-url");
  });

  it("URL sem protocolo → 'not-url'", () => {
    const r = classifyFeedUrl("calendar.google.com/xyz.ics");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("not-url");
  });

  it("protocolo estranho → 'bad-protocol'", () => {
    const r = classifyFeedUrl("ftp://calendar.example.com/x.ics");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("bad-protocol");
  });

  it("aceita https:// → ok + normalized", () => {
    const r = classifyFeedUrl("https://calendar.google.com/calendar/ical/xyz/basic.ics");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.normalized).toContain("https://calendar.google.com");
  });

  it("aceita http:// → ok", () => {
    const r = classifyFeedUrl("http://exemplo.com/feed.ics");
    expect(r.ok).toBe(true);
  });

  it("webcal:// vira https:// no normalized", () => {
    const r = classifyFeedUrl("webcal://p01-caldav.icloud.com/published/x.ics");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.normalized.startsWith("https://")).toBe(true);
  });

  it("WEBCAL:// case-insensitive", () => {
    const r = classifyFeedUrl("WEBCAL://p01.example.com/f.ics");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.normalized.startsWith("https://")).toBe(true);
  });

  it("espaços em volta são tolerados", () => {
    const r = classifyFeedUrl("  https://x.com/y.ics  ");
    expect(r.ok).toBe(true);
  });

  it("mensagens de erro estão em PT-BR", () => {
    for (const bad of ["", "abc", "ftp://x.com"]) {
      const r = classifyFeedUrl(bad);
      if (!r.ok) {
        expect(r.message.length).toBeGreaterThan(0);
        // sanidade: deve conter alguma palavra PT-BR típica
        expect(r.message).toMatch(/[çãáéíõúÁÉÍÓÚ]|link|url|calendário/i);
      }
    }
  });
});
