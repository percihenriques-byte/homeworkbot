import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: vi.fn() } }));
vi.mock("./reminders", () => ({ syncTaskReminder: vi.fn() }));
vi.mock("./autoComplete", () => ({ completeAndEmailTask: vi.fn() }));
vi.mock("./db", () => ({
  getIntegrationSettings: vi.fn(),
  getTasksByUserId: vi.fn(),
  createTask: vi.fn(),
}));

import { syncToddleForUser } from "./toddleSync";
import * as db from "./db";
import { completeAndEmailTask } from "./autoComplete";

const ICS = [
  "BEGIN:VCALENDAR",
  "BEGIN:VEVENT",
  "SUMMARY:Prova de Historia",
  "DTSTART;VALUE=DATE:20260717",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "SUMMARY:Entregar redacao",
  "DTSTART;VALUE=DATE:20260718",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

function mockFetchOk(body: string) {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, text: async () => body })));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  (db.createTask as any).mockImplementation(async (t: any) => ({ id: Math.floor(Math.random() * 1e6), ...t }));
  (db.getTasksByUserId as any).mockResolvedValue([]);
});

describe("syncToddleForUser", () => {
  it("sem link configurado → lança", async () => {
    (db.getIntegrationSettings as any).mockResolvedValue({ toddleApiKey: "" });
    await expect(syncToddleForUser(1)).rejects.toThrow(/link de calend/i);
  });

  it("link inválido/interno (SSRF) → lança", async () => {
    (db.getIntegrationSettings as any).mockResolvedValue({ toddleApiKey: "http://127.0.0.1/feed.ics" });
    await expect(syncToddleForUser(1)).rejects.toThrow(/inválido/i);
  });

  it("importa eventos novos (auto-completar desligado)", async () => {
    (db.getIntegrationSettings as any).mockResolvedValue({ toddleApiKey: "https://cal.exemplo.com/f.ics", toddleEnabled: false });
    mockFetchOk(ICS);
    const r = await syncToddleForUser(1);
    expect(r.imported).toBe(2);
    expect(r.skipped).toBe(0);
    expect(r.autoCompleted).toBe(0);
    expect(db.createTask).toHaveBeenCalledTimes(2);
    expect(completeAndEmailTask).not.toHaveBeenCalled();
  });

  it("deduplica contra tarefas já existentes (título + dia)", async () => {
    (db.getIntegrationSettings as any).mockResolvedValue({ toddleApiKey: "https://cal.exemplo.com/f.ics" });
    (db.getTasksByUserId as any).mockResolvedValue([
      { title: "Prova de Historia", dueDate: new Date(2026, 6, 17, 12) },
    ]);
    mockFetchOk(ICS);
    const r = await syncToddleForUser(1);
    expect(r.imported).toBe(1); // só a redação é nova
    expect(r.skipped).toBe(1);
  });

  it("auto-completar LIGADO → chama completeAndEmailTask por tarefa nova", async () => {
    (db.getIntegrationSettings as any).mockResolvedValue({ toddleApiKey: "https://cal.exemplo.com/f.ics", toddleEnabled: true });
    (completeAndEmailTask as any).mockResolvedValue({ completed: true, emailed: true });
    mockFetchOk(ICS);
    const r = await syncToddleForUser(1);
    expect(r.imported).toBe(2);
    expect(completeAndEmailTask).toHaveBeenCalledTimes(2);
    expect(r.autoCompleted).toBe(2);
    expect(r.emailed).toBe(2);
  });

  it("converte webcal:// para https antes de buscar", async () => {
    (db.getIntegrationSettings as any).mockResolvedValue({ toddleApiKey: "webcal://cal.exemplo.com/f.ics" });
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, text: async () => ICS }));
    vi.stubGlobal("fetch", fetchMock);
    await syncToddleForUser(1);
    expect(fetchMock).toHaveBeenCalled();
    expect((fetchMock.mock.calls[0][0] as string)).toMatch(/^https:\/\//);
  });

  it("feed inacessível (fetch !ok) → lança", async () => {
    (db.getIntegrationSettings as any).mockResolvedValue({ toddleApiKey: "https://cal.exemplo.com/f.ics" });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404, text: async () => "" })));
    await expect(syncToddleForUser(1)).rejects.toThrow(/acessar o calend/i);
  });
});
