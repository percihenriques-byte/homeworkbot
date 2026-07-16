import { test, expect } from "@playwright/test";
import { installTrpcMock, authedUser } from "./mock";

test("rota protegida redireciona visitante (não logado) para a landing", async ({ page }) => {
  await installTrpcMock(page, { user: null });
  await page.goto("/tarefas");

  // Deve cair na landing ("/") com o botão Entrar
  await expect(page.getByRole("link", { name: "Entrar" }).first()).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test("deep-link 'Próximos 7 dias' do Dashboard leva pra Tarefas", async ({ page }) => {
  const due = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  await installTrpcMock(page, {
    user: authedUser,
    tasks: [
      { id: 42, title: "Prova de Química", status: "pendente", dueDate: due, priority: "alta", difficulty: "médio", subject: "Química", completedAt: null },
    ],
  });
  await page.goto("/painel");

  const item = page.getByText("Prova de Química").first();
  await expect(item).toBeVisible();
  await item.click();

  await expect(page).toHaveURL(/\/tarefas/);
  await expect(page.getByText("Prova de Química")).toBeVisible();
});
