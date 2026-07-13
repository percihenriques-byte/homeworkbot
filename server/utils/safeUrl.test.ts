import { describe, it, expect } from "vitest";
import { isSafeFeedUrl } from "./safeUrl";

describe("isSafeFeedUrl", () => {
  it("aceita http/https públicos", () => {
    expect(isSafeFeedUrl("https://calendar.google.com/calendar/ical/abc/basic.ics")).toBe(true);
    expect(isSafeFeedUrl("http://exemplo.com.br/feed.ics")).toBe(true);
    expect(isSafeFeedUrl("https://toddle.com/x?token=123")).toBe(true);
  });

  it("rejeita esquemas não-http", () => {
    expect(isSafeFeedUrl("webcal://exemplo.com/feed.ics")).toBe(false); // convertido antes de validar
    expect(isSafeFeedUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeFeedUrl("ftp://exemplo.com/x")).toBe(false);
    expect(isSafeFeedUrl("javascript:alert(1)")).toBe(false);
  });

  it("rejeita hosts internos/privados (SSRF)", () => {
    expect(isSafeFeedUrl("http://localhost/x")).toBe(false);
    expect(isSafeFeedUrl("http://127.0.0.1/x")).toBe(false);
    expect(isSafeFeedUrl("http://0.0.0.0/x")).toBe(false);
    expect(isSafeFeedUrl("http://[::1]/x")).toBe(false);
    expect(isSafeFeedUrl("http://10.0.0.5/x")).toBe(false);
    expect(isSafeFeedUrl("http://192.168.1.10/x")).toBe(false);
    expect(isSafeFeedUrl("http://169.254.169.254/latest/meta-data")).toBe(false); // metadata cloud
    expect(isSafeFeedUrl("http://172.16.0.1/x")).toBe(false);
    expect(isSafeFeedUrl("http://172.31.255.255/x")).toBe(false);
    expect(isSafeFeedUrl("http://algo.local/x")).toBe(false);
  });

  it("aceita IPs 172.x fora da faixa privada", () => {
    expect(isSafeFeedUrl("http://172.15.0.1/x")).toBe(true);
    expect(isSafeFeedUrl("http://172.32.0.1/x")).toBe(true);
  });

  it("rejeita lixo / vazio", () => {
    expect(isSafeFeedUrl("")).toBe(false);
    expect(isSafeFeedUrl("não é url")).toBe(false);
  });
});
