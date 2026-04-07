import { test, expect } from "@playwright/test";

test.describe("Documents", () => {
  test("navegar a /documents muestra la página de documentos", async ({ page }) => {
    await page.goto("/documents");
    await page.waitForTimeout(1000);
    await expect(page.locator("h1, [role='heading']").first()).toBeVisible();
  });

  test("la página carga sin errores y muestra algún contenido", async ({ page }) => {
    await page.goto("/documents");
    await page.waitForTimeout(2000);
    // El heading principal debe estar visible
    await expect(page.locator("h1, [role='heading']").first()).toBeVisible();
    // No debe haber un overlay de error de Next.js
    const hasNextError = await page.locator("body > div#__next_error__").count();
    expect(hasNextError).toBe(0);
  });

  test("el botón de añadir documento o controles de página son visibles", async ({ page }) => {
    await page.goto("/documents");
    await page.waitForTimeout(1500);
    // Debe haber algún botón en la página
    const hasButton = await page.locator("button").count();
    expect(hasButton).toBeGreaterThan(0);
  });
});
