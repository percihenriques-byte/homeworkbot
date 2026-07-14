import { test, expect } from "@playwright/test";
import { installTrpcMock, authedUser } from "./mock";

test("jogar quiz: responder certo mostra feedback e placar final", async ({ page }) => {
  await installTrpcMock(page, {
    user: authedUser,
    quizzes: [
      {
        id: 1,
        title: "Quiz: Matemática",
        subject: "Matemática",
        questions: [{ question: "Quanto é 2+2?", options: ["3", "4"], correctAnswer: "4" }],
        totalQuestions: 1,
      },
    ],
  });
  await page.goto("/ferramentas");

  await page.getByRole("button", { name: /Quiz: Matemática/ }).click();
  await expect(page.getByText("Quanto é 2+2?")).toBeVisible();

  await page.getByRole("button", { name: "4", exact: true }).click();
  await expect(page.getByText("Correto!")).toBeVisible();

  await page.getByRole("button", { name: "Ver resultado" }).click();
  await expect(page.getByText(/1 de 1 questões corretas/)).toBeVisible();
});

test("estudar deck: vira o card (pergunta↔resposta) e navega", async ({ page }) => {
  await installTrpcMock(page, {
    user: authedUser,
    flashcards: [
      { id: 1, question: "Pergunta Um", answer: "Resposta Um", subject: "Mat", timesReviewed: 0 },
      { id: 2, question: "Pergunta Dois", answer: "Resposta Dois", subject: "Mat", timesReviewed: 0 },
    ],
  });
  await page.goto("/ferramentas");

  await page.getByRole("button", { name: "Estudar todos" }).click();
  const deck = page.getByRole("dialog");
  await expect(deck.getByText("Pergunta Um")).toBeVisible();

  await deck.getByText("Pergunta Um").click();
  await expect(deck.getByText("Resposta Um")).toBeVisible();

  await deck.getByRole("button", { name: "Próximo" }).click();
  await expect(deck.getByText("Pergunta Dois")).toBeVisible();
});

test("dashboard mostra stats e o CTA 'Pedir ao Jarvis'", async ({ page }) => {
  await installTrpcMock(page, {
    user: authedUser,
    tasks: [
      { id: 1, title: "Tarefa Pendente", status: "pendente", dueDate: null, priority: "média", difficulty: "médio", subject: "Mat", completedAt: null },
    ],
  });
  await page.goto("/painel");

  await expect(page.getByRole("button", { name: /Pedir ao Jarvis/ })).toBeVisible();
  await expect(page.getByText("Pendentes")).toBeVisible();
  await expect(page.getByText("Seu estudo")).toBeVisible();
});
