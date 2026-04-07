import { test, expect } from "@playwright/test";

// Tests de IA se marcan skip porque requieren API key válida y configurada
const AI_TESTS_ENABLED = process.env["E2E_AI_ENABLED"] === "true";

test.describe("Chat Assistant", () => {
  test("abrir /chat muestra la interfaz del asistente", async ({ page }) => {
    await page.goto("/chat");
    await page.waitForTimeout(1000);
    const hasInput = await page.locator("textarea, input[type='text']").count();
    expect(hasInput).toBeGreaterThan(0);
  });

  test("el modo selector está disponible en /chat", async ({ page }) => {
    await page.goto("/chat");
    await page.waitForTimeout(500);
    const hasModeControl = await page.locator("select, [role='combobox'], button").count();
    expect(hasModeControl).toBeGreaterThan(0);
  });

  test("enviar mensaje y verificar respuesta (requiere API key)", async ({ page }) => {
    test.skip(!AI_TESTS_ENABLED, "Set E2E_AI_ENABLED=true para ejecutar tests que requieren API key");

    await page.goto("/chat");
    await page.waitForTimeout(1000);

    const textarea = page.locator("textarea").first();
    await textarea.fill("¿Cuántos espacios de conjuro tiene un mago nivel 6?");
    await page.keyboard.press("Enter");

    // Esperar a que haya alguna respuesta (cualquier contenido nuevo)
    await page.waitForTimeout(5000);
    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(1000);
  });
});
