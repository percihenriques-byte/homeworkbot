import { test, expect } from "@playwright/test";
import { installTrpcMock } from "./mock";

// Usuário NÃO logado abrindo o site: deve ver a landing com o botão de entrar
// e os recursos. Confirma que o app React monta sem erro de runtime.
test("landing renderiza para visitante não logado", async ({ page }) => {
  await installTrpcMock(page, { user: null });

  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto("/");

  await expect(page.getByText("Homework Assistant").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Entrar" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recursos Poderosos" })).toBeVisible();
  await expect(page.getByText(/Começar Agora/)).toBeVisible();

  expect(errors, "não deve haver erros de runtime no console").toEqual([]);
});
