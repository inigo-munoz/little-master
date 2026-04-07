import { test, expect } from "@playwright/test";

test.describe("Campaigns", () => {
  test("navegar a /campaigns muestra la lista de campañas", async ({ page }) => {
    await page.goto("/campaigns");
    await expect(page).toHaveTitle(/D&D|Campaign|Assistant/i);
    // La página debe tener al menos un heading o contenedor principal
    await expect(page.locator("h1, [role='heading']").first()).toBeVisible();
  });

  test("la lista contiene al menos una campaña o muestra estado vacío", async ({ page }) => {
    await page.goto("/campaigns");
    // Esperar a que cargue (loading skeleton o contenido)
    await page.waitForTimeout(1500);
    const hasCards = await page.locator("a[href^='/campaigns/']").count();
    const hasEmpty = await page.locator("text=/no hay campañas|nueva campaña|create/i").count();
    expect(hasCards + hasEmpty).toBeGreaterThan(0);
  });

  test("hacer clic en una campaña abre el detalle", async ({ page }) => {
    await page.goto("/campaigns");
    await page.waitForTimeout(1500);

    const campaignLink = page.locator("a[href^='/campaigns/']").first();
    const count = await campaignLink.count();
    if (count === 0) {
      test.skip(true, "No hay campañas disponibles");
      return;
    }

    await campaignLink.click();
    await page.waitForTimeout(1000);
    // Debe mostrar pestañas o contenido de campaña
    const hasTabs = await page.locator("[role='tab'], button:has-text('NPCs'), button:has-text('Sesiones')").count();
    expect(hasTabs).toBeGreaterThan(0);
  });

  test("la pestaña NPCs en el detalle de campaña muestra contenido", async ({ page }) => {
    await page.goto("/campaigns");
    await page.waitForTimeout(1500);

    const campaignLink = page.locator("a[href^='/campaigns/']").first();
    if (await campaignLink.count() === 0) {
      test.skip(true, "No hay campañas disponibles");
      return;
    }

    await campaignLink.click();
    await page.waitForTimeout(500);

    const npcsTab = page.locator("button:has-text('NPCs'), [role='tab']:has-text('NPCs')").first();
    if (await npcsTab.count() > 0) {
      await npcsTab.click();
      await page.waitForTimeout(500);
      // Debe mostrar lista de NPCs o estado vacío
      const hasContent = await page.locator("text=/NPC|personaje|no hay/i").count();
      expect(hasContent).toBeGreaterThan(0);
    }
  });
});
