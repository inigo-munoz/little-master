import type { LLMProvider, PromptInput, LLMTextResponse, LLMModel } from "../types/index.js";

const OPENAI_API_URL = "https://api.openai.com/v1";

export class OpenAIProvider implements LLMProvider {
  readonly name = "openai";

  constructor(
    private readonly apiKey: string,
    private readonly defaultModel: string = "gpt-4o-mini"
  ) {}

  async generateText(input: PromptInput): Promise<LLMTextResponse> {
    const messages = [];

    if (input.systemPrompt) {
      messages.push({ role: "system", content: input.systemPrompt });
    }
    messages.push(...input.messages);

    const res = await fetch(`${OPENAI_API_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: input.model ?? this.defaultModel,
        messages,
        temperature: input.temperature ?? 0.7,
        max_tokens: input.maxTokens ?? 2048,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as any;
      const message = body?.error?.message ?? "Unknown error";

      if (res.status === 429 && message.includes("insufficient_quota")) {
        throw Object.assign(new Error("INSUFFICIENT_CREDITS: " + message), { code: "INSUFFICIENT_CREDITS", provider: "openai" });
      }
      if (res.status === 401) {
        throw Object.assign(new Error("INVALID_API_KEY: " + message), { code: "INVALID_API_KEY", provider: "openai" });
      }
      if (res.status === 429) {
        throw Object.assign(new Error("RATE_LIMITED: " + message), { code: "RATE_LIMITED", provider: "openai" });
      }

      throw new Error(`OpenAI API error ${res.status}: ${JSON.stringify(body)}`);
    }

    const data = await res.json() as any;
    const choice = (data as any).choices?.[0];

    return {
      content: choice?.message?.content ?? "",
      tokensUsed: data.usage?.total_tokens ?? 0,
      model: data.model ?? this.defaultModel,
      finishReason: choice?.finish_reason === "length" ? "length" : "stop",
    };
  }

  async embedText(input: string): Promise<number[]> {
    const res = await fetch(`${OPENAI_API_URL}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input,
      }),
    });

    if (!res.ok) throw new Error(`OpenAI embeddings error ${res.status}`);

    const data = await res.json() as any;
    return (data as any).data?.[0]?.embedding ?? [];
  }

  countTokens(input: string): number {
    // Rough approximation: 1 token ≈ 4 chars
    // In production, use tiktoken
    return Math.ceil(input.length / 4);
  }

  async listModels(): Promise<LLMModel[]> {
    const res = await fetch(`${OPENAI_API_URL}/models`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });

    if (!res.ok) return [];

    const data = await res.json() as any;
    const chatModels = (data.data ?? []).filter(
      (m: { id: string }) =>
        m.id.startsWith("gpt-4") || m.id.startsWith("gpt-3.5") || m.id.startsWith("o1")
    );

    return chatModels.map((m: { id: string }) => ({
      id: m.id,
      name: m.id,
      contextWindow: m.id.includes("128k") ? 128000 : 16384,
      supportsEmbeddings: false,
    }));
  }

  async validateKey(apiKey: string): Promise<boolean> {
    try {
      const res = await fetch(`${OPENAI_API_URL}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
