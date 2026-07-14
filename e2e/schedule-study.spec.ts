import { test, expect } from "@playwright/test";
import { installTrpcMock, authedUser } from "./mock";

const twoDaySchedule = {
  id: 1,
  schedule: [
    { date: "2026-07-15", subject: "Matemática", tasks: ["Estudar frações"], duration: "1h", done: false },
    { date: "2026-07-16", subject: "Português", tasks: ["Ler capítulo 3"], duration: "1h30", done: false },
  ],
};

test.describe("Cronograma", () => {
  test("gerar cronograma a partir do vazio mostra os dias", async ({ page }) => {
    await installTrpcMock(page, { user: authedUser, schedule: null, tasks: [{ id: 1, title: "T", status: "pendente", dueDate: null }] });
    await page.goto("/cronograma");
    await expect(page.getByText(/Nenhum cronograma gerado ainda/i)).toBeVisible();
    await page.getByRole("button", { name: /Gerar Meu Primeiro Cronograma|Gerar Cronograma/ }).first().click();
    await expect(page.getByText("2026-07-15")).toBeVisible();
    await expect(page.getByText("Estudar frações")).toBeVisible();
  });

  test("marcar um dia como concluído", async ({ page }) => {
    await installTrpcMock(page, { user: authedUser, schedule: JSON.parse(JSON.stringify(twoDaySchedule)) });
    await page.goto("/cronograma");
    await page.getByRole("button", { name: "Marcar dia como concluído" }).first().click();
    await expect(page.getByRole("button", { name: "Marcar dia como não concluído" }).first()).toBeVisible();
  });

  test("reordenar: mover o primeiro dia para baixo troca a ordem", async ({ page }) => {
    await installTrpcMock(page, { user: authedUser, schedule: JSON.parse(JSON.stringify(twoDaySchedule)) });
    await page.goto("/cronograma");
    await expect(page.getByRole("heading", { level: 3 }).first()).toHaveText("2026-07-15");
    await page.getByRole("button", { name: "Mover dia para baixo" }).first().click();
    await expect(page.getByRole("heading", { level: 3 }).first()).toHaveText("2026-07-16");
  });
});

test.describe("Ferramentas de Estudo", () => {
  test("gerar flashcards pela IA os faz aparecer em Meus Materiais", async ({ page }) => {
    await installTrpcMock(page, { user: authedUser, flashcards: [] });
    await page.goto("/ferramentas");

    await page.getByRole("button", { name: /Gerar com IA/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByPlaceholder("Cole o conteúdo aqui...").fill("Matéria de matemática básica para os flashcards.");
    await page.getByRole("button", { name: "Gerar Flashcards" }).click();

    await expect(page.getByText("Quanto é 2+2?")).toBeVisible();
  });
});
