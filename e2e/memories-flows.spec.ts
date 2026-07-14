import { test, expect } from "@playwright/test";
import { installTrpcMock, authedUser } from "./mock";

const seedMemory = {
  id: 1,
  userId: 1,
  title: "Meu estilo de redação",
  category: "Escrita",
  content: "Escrevo de forma direta e clara, com exemplos.",
  source: "ChatGPT",
  createdAt: new Date().toISOString(),
};

test("criar memória pela interface", async ({ page }) => {
  await installTrpcMock(page, { user: authedUser, memories: [] });
  await page.goto("/memorias");

  await page.getByRole("button", { name: /Adicionar Primeira Memória|Nova Memória/ }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByPlaceholder("Ex: Conversa ChatGPT - Matemática").fill("Minha primeira memória");
  await page.getByPlaceholder(/Cole a conversa completa/).fill("Conteúdo de exemplo da memória para a IA aprender.");
  await page.getByRole("button", { name: "Salvar Memória" }).click();

  await expect(page.getByText("Minha primeira memória")).toBeVisible();
});

test("editar memória existente reflete o novo título", async ({ page }) => {
  await installTrpcMock(page, { user: authedUser, memories: [{ ...seedMemory }] });
  await page.goto("/memorias");
  await expect(page.getByText("Meu estilo de redação")).toBeVisible();

  await page.getByRole("button", { name: "Editar memória" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Editar Memória")).toBeVisible();
  await page.getByPlaceholder("Ex: Conversa ChatGPT - Matemática").fill("Estilo atualizado");
  await page.getByRole("button", { name: "Salvar Alterações" }).click();

  await expect(page.getByText("Estilo atualizado")).toBeVisible();
});

test("deletar memória com confirmação e desfazer", async ({ page }) => {
  await installTrpcMock(page, { user: authedUser, memories: [{ ...seedMemory }] });
  await page.goto("/memorias");

  await page.getByRole("button", { name: "Remover memória" }).click();
  await page.getByRole("button", { name: "Sim, remover" }).click();
  await expect(page.getByText("Meu estilo de redação")).toBeHidden();

  await page.getByRole("button", { name: "Desfazer" }).click();
  await expect(page.getByText("Meu estilo de redação")).toBeVisible();
});
