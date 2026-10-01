import { afterEach, describe, expect, it, vi } from "vitest";
import { createProvider } from "./factory.js";

function stubFetch() {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function requestedUrls(fetchMock: ReturnType<typeof stubFetch>): string[] {
  return fetchMock.mock.calls.map((call) => String((call as unknown[])[0]));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createProvider base URL routing", () => {
  it("sends every openrouter request to openrouter.ai and never to api.openai.com", async () => {
    const fetchMock = stubFetch();
    const provider = createProvider("openrouter", "sk-or-secret", "some/model");

    await provider.listModels();
    await provider.embedText("hello");
    await provider.validateKey("sk-or-secret");
    await provider.generateText({ messages: [{ role: "user", content: "hi" }] });

    const urls = requestedUrls(fetchMock);
    expect(urls.length).toBeGreaterThanOrEqual(4);
    for (const url of urls) {
      expect(new URL(url).host).toBe("openrouter.ai");
      expect(url).not.toContain("api.openai.com");
    }
  });

  it("keeps sending openai requests to api.openai.com", async () => {
    const fetchMock = stubFetch();
    const provider = createProvider("openai", "sk-openai", "gpt-4o-mini");

    await provider.listModels();
    await provider.embedText("hello");
    await provider.validateKey("sk-openai");
    await provider.generateText({ messages: [{ role: "user", content: "hi" }] });

    const urls = requestedUrls(fetchMock);
    expect(urls.length).toBeGreaterThanOrEqual(4);
    for (const url of urls) {
      expect(new URL(url).host).toBe("api.openai.com");
    }
  });
});
