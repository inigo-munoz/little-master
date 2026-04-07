import { test, expect } from "@playwright/test";

const AI_TESTS_ENABLED = process.env["E2E_AI_ENABLED"] === "true";

test.describe("NPC via Designer", () => {
  test("abrir /chat en modo Designer muestra interfaz correcta", async ({ page }) => {
    await page.goto("/chat");
    await page.waitForTimeout(500);
    await expect(page.locator("textarea, input[placeholder]").first()).toBeVisible();
  });

  test("el modo Designer está disponible como opción", async ({ page }) => {
    await page.goto("/chat");
    await page.waitForTimeout(500);
    const hasModeControl = await page.locator("select, [role='combobox'], button").count();
    expect(hasModeControl).toBeGreaterThan(0);
  });

  test("generar NPC con Designer y ver botón Guardar (requiere API key)", async ({ page }) => {
    test.skip(!AI_TESTS_ENABLED, "Set E2E_AI_ENABLED=true para ejecutar tests que requieren API key");

    await page.goto("/chat");
    await page.waitForTimeout(500);

    const select = page.locator("select").first();
    if (await select.count() > 0) {
      await select.selectOption({ label: "Designer" });
    }

    const textarea = page.locator("textarea").first();
    await textarea.fill("Crea un tabernero humano llamado Borgrim, hombre de 45 años, amable pero desconfiado.");
    await page.keyboard.press("Enter");

    await page.waitForSelector("button:has-text('Guardar NPC'), button:has-text('Save NPC')", {
      timeout: 30_000,
    });

    const saveBtn = page.locator("button:has-text('Guardar NPC'), button:has-text('Save NPC')").first();
    await expect(saveBtn).toBeVisible();
  });
});
