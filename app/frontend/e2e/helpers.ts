import type { Page } from "@playwright/test";

const BACKEND_URL = process.env["NEXT_PUBLIC_BACKEND_URL"] ?? "http://localhost:3001";

/**
 * Espera a que el backend responda en /health.
 * Útil para evitar fallos por arranque lento.
 */
export async function waitForBackend(page: Page, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await page.request.get(`${BACKEND_URL}/health`);
      if (res.ok()) return;
    } catch {
      // backend no disponible aún
    }
    await page.waitForTimeout(500);
  }
  throw new Error(`Backend no respondió en ${timeoutMs}ms`);
}

/**
 * Navega a /campaigns y hace clic en la primera campaña de la lista.
 * Devuelve el título de la campaña seleccionada.
 */
export async function setupCampaign(page: Page): Promise<string> {
  await page.goto("/campaigns");
  await page.waitForSelector("[data-testid='campaign-card'], .campaign-card, a[href^='/campaigns/']", {
    timeout: 10_000,
  }).catch(() => null);

  const firstLink = page.locator("a[href^='/campaigns/']").first();
  const title = await firstLink.textContent() ?? "";
  await firstLink.click();
  return title.trim();
}
