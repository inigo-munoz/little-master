import { test, expect } from "@playwright/test";

const BACKEND = "http://localhost:3001";

test.describe("Document Upload", () => {
  test("la API de documentos responde y muestra documentos", async ({ page }) => {
    const res = await page.request.get(`${BACKEND}/api/documents`);
    expect(res.ok()).toBe(true);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
  });

  test("crear documento vía API y verificar que aparece en la lista", async ({ page }) => {
    // Verificar si hay plan DM activo (sin DM no se puede crear documentos)
    const licenseRes = await page.request.get(`${BACKEND}/api/license/status`);
    const license = await licenseRes.json();
    if (license.data?.plan === "free") {
      test.skip(true, "Se necesita plan DM para crear documentos — activa una licencia DM");
      return;
    }

    // Crear documento via API
    const createRes = await page.request.post(`${BACKEND}/api/documents`, {
      data: {
        title: "Test E2E Upload Doc",
        content: "Contenido de prueba para test E2E.",
        contentType: "plaintext",
        sourceType: "homebrew_user",
        authorityLevel: "low",
      },
    });
    expect(createRes.status()).toBe(201);
    const doc = await createRes.json();
    expect(doc.data.id).toBeTruthy();

    // Verificar que aparece en la lista
    const listRes = await page.request.get(`${BACKEND}/api/documents`);
    const list = await listRes.json();
    const found = list.data.find((d: any) => d.id === doc.data.id);
    expect(found).toBeTruthy();

    // Limpiar
    await page.request.delete(`${BACKEND}/api/documents/${doc.data.id}`);
  });

  test("navegar a /documents y ver la página carga correctamente", async ({ page }) => {
    await page.goto("/documents");
    await page.waitForTimeout(1500);
    await expect(page.locator("h1, [role='heading']").first()).toBeVisible();
    // No debe haber error
    const hasErrorBoundary = await page.locator("text=/Error|Something went wrong/i").count();
    expect(hasErrorBoundary).toBe(0);
  });
});
