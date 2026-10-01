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

  it("sends ollama requests to the local Ollama server and never to a remote host", async () => {
    const fetchMock = stubFetch();
    const provider = createProvider("ollama", "unused", "gemma3:4b");

    await provider.listModels();
    await provider.generateText({ messages: [{ role: "user", content: "hi" }] });

    const urls = requestedUrls(fetchMock);
    expect(urls.length).toBeGreaterThanOrEqual(2);
    for (const url of urls) {
      expect(new URL(url).host).toBe("localhost:11434");
    }
  });

  it("does not throw for ollama any more", () => {
    expect(() => createProvider("ollama", "unused", "gemma3:4b")).not.toThrow();
  });

  it("does not apply the OpenAI model allowlist to other backends", async () => {
    const catalogue = {
      data: [{ id: "gemma3:4b" }, { id: "anthropic/claude-3.5-sonnet" }, { id: "openai/gpt-4o" }],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(catalogue), { status: 200 }))
    );

    const ollama = await createProvider("ollama", "unused", "gemma3:4b").listModels();
    expect(ollama.map((m) => m.id)).toEqual([
      "gemma3:4b",
      "anthropic/claude-3.5-sonnet",
      "openai/gpt-4o",
    ]);

    const openrouter = await createProvider("openrouter", "sk-or", "openai/gpt-4o").listModels();
    expect(openrouter).toHaveLength(3);
  });

  it("still filters the OpenAI catalogue down to chat models", async () => {
    const catalogue = {
      data: [{ id: "gpt-4o" }, { id: "text-embedding-3-small" }, { id: "whisper-1" }],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(catalogue), { status: 200 }))
    );

    const openai = await createProvider("openai", "sk-openai", "gpt-4o").listModels();
    expect(openai.map((m) => m.id)).toEqual(["gpt-4o"]);
  });
});
