import { test, expect } from "@playwright/test";
import { installTrpcMock, authedUser } from "./mock";

test.describe("Configurações", () => {
  test("salvar o link do calendário do Toddle mostra sucesso", async ({ page }) => {
    await installTrpcMock(page, { user: authedUser, integrationSettings: null });
    await page.goto("/configuracoes");

    await page
      .getByPlaceholder(/link de assinatura do calendário do Toddle/i)
      .fill("https://calendar.google.com/calendar/ical/abc/basic.ics");
    await page.getByRole("button", { name: "Salvar Integrações" }).click();

    await expect(page.getByText("Integrações configuradas!")).toBeVisible();
  });

  test("salvar sem preencher nada mostra erro de validação", async ({ page }) => {
    await installTrpcMock(page, { user: authedUser, integrationSettings: null });
    await page.goto("/configuracoes");
    await page.getByRole("button", { name: "Salvar Integrações" }).click();
    await expect(page.getByText(/Adicione pelo menos um/i)).toBeVisible();
  });
});

test.describe("Jarvis (chat)", () => {
  test("nova conversa mostra o card de boas-vindas com exemplos", async ({ page }) => {
    await installTrpcMock(page, { user: authedUser, conversations: [] });
    await page.goto("/chat");

    // "Nova conversa" cria direto (sem dialog intermediário).
    await page.getByRole("button", { name: "Nova conversa" }).first().click();

    await expect(page.getByText(/Jarvis de Estudos/i)).toBeVisible();
    await expect(page.getByText(/gere 8 flashcards do assunto/i)).toBeVisible();
  });

  test("enviar mensagem mostra a resposta do assistente", async ({ page }) => {
    await installTrpcMock(page, { user: authedUser, conversations: [] });
    await page.goto("/chat");
    // "Nova conversa" cria direto (sem dialog intermediário).
    await page.getByRole("button", { name: "Nova conversa" }).first().click();

    await page.getByPlaceholder(/Peça algo ao Jarvis/i).fill("Olá Jarvis");
    await page.getByRole("button", { name: "Enviar mensagem" }).click();

    await expect(page.getByText("Olá Jarvis")).toBeVisible();
    await expect(page.getByText(/resposta do Jarvis \(mock\)/i)).toBeVisible();
  });
});
