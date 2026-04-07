import { test, expect } from "@playwright/test";

const BACKEND = "http://localhost:3001";

test.describe("PDF Export", () => {
  test("GET /api/pdf/campaign/:id devuelve application/pdf para una campaña", async ({ page }) => {
    const campaignRes = await page.request.get(`${BACKEND}/api/campaigns`);
    const campaignJson = await campaignRes.json();
    const campaigns = campaignJson.data ?? [];

    if (campaigns.length === 0) {
      test.skip(true, "No hay campañas disponibles para probar PDF");
      return;
    }

    const campaignId = campaigns[0].id;
    const pdfRes = await page.request.get(`${BACKEND}/api/pdf/campaign/${campaignId}`);
    expect(pdfRes.status()).toBe(200);
    expect(pdfRes.headers()["content-type"]).toContain("application/pdf");
    const body = await pdfRes.body();
    expect(body.length).toBeGreaterThan(1000);
  });

  test("PDF de campaña contiene cabecera PDF válida (%PDF)", async ({ page }) => {
    const campaignRes = await page.request.get(`${BACKEND}/api/campaigns`);
    const campaignJson = await campaignRes.json();
    const campaigns = campaignJson.data ?? [];

    if (campaigns.length === 0) {
      test.skip(true, "No hay campañas disponibles");
      return;
    }

    const pdfRes = await page.request.get(`${BACKEND}/api/pdf/campaign/${campaigns[0].id}`);
    const body = await pdfRes.body();
    // Los PDFs empiezan con "%PDF"
    const header = body.slice(0, 4).toString("ascii");
    expect(header).toBe("%PDF");
  });

  test("GET /api/pdf/npc/:id devuelve PDF para NPC de la primera campaña", async ({ page }) => {
    const campaignRes = await page.request.get(`${BACKEND}/api/campaigns`);
    const campaigns = (await campaignRes.json()).data ?? [];
    if (campaigns.length === 0) {
      test.skip(true, "No hay campañas disponibles");
      return;
    }

    const npcRes = await page.request.get(`${BACKEND}/api/npcs?campaignId=${campaigns[0].id}`);
    const npcs = (await npcRes.json()).data ?? [];

    if (npcs.length === 0) {
      test.skip(true, "No hay NPCs en la primera campaña");
      return;
    }

    const pdfRes = await page.request.get(`${BACKEND}/api/pdf/npc/${npcs[0].id}`);
    expect(pdfRes.status()).toBe(200);
    expect(pdfRes.headers()["content-type"]).toContain("application/pdf");
    const body = await pdfRes.body();
    expect(body.slice(0, 4).toString("ascii")).toBe("%PDF");
  });
});
