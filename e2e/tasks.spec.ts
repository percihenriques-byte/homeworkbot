import { test, expect } from "@playwright/test";
import { installTrpcMock, authedUser } from "./mock";

// Usuário logado criando uma tarefa PELA INTERFACE (como faria de verdade):
// abre o formulário, digita o título, clica em Criar e vê a tarefa na lista.
test("usuário cria uma tarefa pela interface e ela aparece na lista", async ({ page }) => {
  await installTrpcMock(page, { user: authedUser, tasks: [] });

  await page.goto("/tarefas");

  // Estado vazio inicial
  await expect(page.getByText(/Nenhuma tarefa criada ainda/i)).toBeVisible();

  // Abre o formulário e preenche
  await page.getByRole("button", { name: "Nova Tarefa" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByPlaceholder("Digite o título da tarefa").fill("Prova de Matemática");
  await page.getByRole("button", { name: "Criar" }).click();

  // A tarefa criada aparece na lista
  await expect(page.getByText("Prova de Matemática")).toBeVisible();
  await expect(page.getByText(/Nenhuma tarefa criada ainda/i)).not.toBeVisible();
});
