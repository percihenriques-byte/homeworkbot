import { describe, expect, it } from "vitest";
import { computeStudyStats } from "./studyStats";

const NOW = new Date(2026, 6, 15, 12, 0, 0); // 15/jul/2026 12:00 local
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 3600 * 1000);
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600 * 1000);

describe("computeStudyStats", () => {
  it("input vazio → zeros", () => {
    expect(computeStudyStats({}, NOW)).toEqual({
      flashcards: 0,
      reviews: 0,
      conversations: 0,
      memories: 0,
      activeDays: 0,
    });
  });

  it("nenhum argumento → não crasha, zeros", () => {
    expect(computeStudyStats(undefined, NOW).flashcards).toBe(0);
  });

  it("conta flashcards + soma timesReviewed", () => {
    const s = computeStudyStats(
      {
        flashcards: [
          { timesReviewed: 3 },
          { timesReviewed: 5 },
          { timesReviewed: null },
        ],
      },
      NOW
    );
    expect(s.flashcards).toBe(3);
    expect(s.reviews).toBe(8);
  });

  it("timesReviewed em string numérica também conta", () => {
    const s = computeStudyStats(
      { flashcards: [{ timesReviewed: "4" as any }, { timesReviewed: "2" as any }] },
      NOW
    );
    expect(s.reviews).toBe(6);
  });

  it("timesReviewed inválido é ignorado (não vira NaN)", () => {
    const s = computeStudyStats(
      { flashcards: [{ timesReviewed: "abc" as any }, { timesReviewed: 7 }] },
      NOW
    );
    expect(s.reviews).toBe(7);
  });

  it("conta conversas e memórias", () => {
    const s = computeStudyStats(
      {
        conversations: [{}, {}, {}],
        memories: [{}, {}],
      },
      NOW
    );
    expect(s.conversations).toBe(3);
    expect(s.memories).toBe(2);
  });

  it("activeDays: 3 dias distintos nos últimos 7", () => {
    const s = computeStudyStats(
      {
        tasks: [{ completedAt: hoursAgo(1) }, { completedAt: hoursAgo(2) }], // hoje
        conversations: [{ updatedAt: daysAgo(2) }],
        memories: [{ createdAt: daysAgo(4) }],
        flashcards: [{ lastReviewedAt: daysAgo(2) }], // mesmo dia da conversa
      },
      NOW
    );
    expect(s.activeDays).toBe(3);
  });

  it("activeDays ignora atividades além dos 7 dias", () => {
    const s = computeStudyStats(
      {
        tasks: [
          { completedAt: hoursAgo(1) }, // hoje
          { completedAt: daysAgo(30) }, // fora da janela
        ],
      },
      NOW
    );
    expect(s.activeDays).toBe(1);
  });

  it("activeDays ignora datas no futuro", () => {
    const future = new Date(NOW.getTime() + 24 * 3600 * 1000);
    const s = computeStudyStats(
      { tasks: [{ completedAt: future }, { completedAt: hoursAgo(1) }] },
      NOW
    );
    expect(s.activeDays).toBe(1);
  });

  it("activeDays ignora null/undefined/data inválida", () => {
    const s = computeStudyStats(
      {
        tasks: [
          { completedAt: null },
          { completedAt: undefined },
          { completedAt: "nao-e-data" as any },
          { completedAt: hoursAgo(1) },
        ],
      },
      NOW
    );
    expect(s.activeDays).toBe(1);
  });

  it("string ISO em completedAt é aceita", () => {
    const s = computeStudyStats(
      { tasks: [{ completedAt: hoursAgo(1).toISOString() }] },
      NOW
    );
    expect(s.activeDays).toBe(1);
  });

  it("determinístico com mesmo `now`", () => {
    const input = { tasks: [{ completedAt: hoursAgo(3) }] };
    expect(computeStudyStats(input, NOW)).toEqual(computeStudyStats(input, NOW));
  });
});
