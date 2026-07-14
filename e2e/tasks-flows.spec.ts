import { test, expect } from "@playwright/test";
import { installTrpcMock, authedUser } from "./mock";

const seedTask = {
  id: 1,
  userId: 1,
  title: "Tarefa Seed",
  description: "descrição da tarefa",
  status: "pendente",
  priority: "média",
  difficulty: "médio",
  type: "tarefa",
  subject: "Matemática",
  dueDate: null,
  completedAt: null,
  completedContent: null,
  notes: "",
  referenceFiles: null,
  createdAt: new Date().toISOString(),
};

test.beforeEach(async ({ page }) => {
  await installTrpcMock(page, { user: authedUser, tasks: [{ ...seedTask }] });
});

test("editar tarefa muda o título e reflete na lista", async ({ page }) => {
  await page.goto("/tarefas");
  await expect(page.getByText("Tarefa Seed")).toBeVisible();
  await page.getByRole("button", { name: "Editar tarefa" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByPlaceholder("Digite o título da tarefa").fill("Tarefa Editada");
  await page.getByRole("button", { name: "Atualizar" }).click();
  await expect(page.getByText("Tarefa Editada")).toBeVisible();
});

test("concluir tarefa some da lista de pendentes", async ({ page }) => {
  await page.goto("/tarefas");
  await page.getByRole("button", { name: "Marcar como concluída" }).first().click();
  await expect(page.getByText("Tarefa Seed")).toBeHidden();
});

test("duplicar tarefa cria uma cópia", async ({ page }) => {
  await page.goto("/tarefas");
  await page.getByRole("button", { name: "Duplicar tarefa" }).click();
  await expect(page.getByText("Tarefa Seed (cópia)")).toBeVisible();
});

test("deletar tarefa com confirmação e depois desfazer", async ({ page }) => {
  await page.goto("/tarefas");
  await page.getByRole("button", { name: "Deletar tarefa" }).click();
  await page.getByRole("button", { name: "Sim, deletar" }).click();
  await expect(page.getByText("Tarefa Seed")).toBeHidden();
  await page.getByRole("button", { name: "Desfazer" }).click();
  await expect(page.getByText("Tarefa Seed")).toBeVisible();
});
