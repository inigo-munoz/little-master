import type { LLMProvider, PromptInput, LLMTextResponse, LLMModel } from "../types/index.js";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1";
const ANTHROPIC_VERSION = "2023-06-01";

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";

  constructor(
    private readonly apiKey: string,
    private readonly defaultModel: string = "claude-3-5-haiku-20241022"
  ) {}

  async generateText(input: PromptInput): Promise<LLMTextResponse> {
    const res = await fetch(`${ANTHROPIC_API_URL}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: input.model ?? this.defaultModel,
        system: input.systemPrompt ?? "You are a helpful D&D campaign assistant.",
        messages: input.messages.map((m) => ({
          role: m.role === "system" ? "user" : m.role,
          content: m.content,
        })),
        max_tokens: input.maxTokens ?? 2048,
        temperature: input.temperature ?? 0.7,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as any;
      const message = body?.error?.message ?? "Unknown error";

      // Detect specific error types so the frontend can show actionable messages
      if (res.status === 400 && message.includes("credit balance")) {
        throw Object.assign(new Error("INSUFFICIENT_CREDITS: " + message), { code: "INSUFFICIENT_CREDITS", provider: "anthropic" });
      }
      if (res.status === 401) {
        throw Object.assign(new Error("INVALID_API_KEY: " + message), { code: "INVALID_API_KEY", provider: "anthropic" });
      }
      if (res.status === 429) {
        throw Object.assign(new Error("RATE_LIMITED: " + message), { code: "RATE_LIMITED", provider: "anthropic" });
      }

      throw new Error(`Anthropic API error ${res.status}: ${JSON.stringify(body)}`);
    }

    const data = await res.json() as any;
    const textBlock = data.content?.find((b: { type: string }) => b.type === "text");

    return {
      content: textBlock?.text ?? "",
      tokensUsed: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
      model: data.model ?? this.defaultModel,
      finishReason: data.stop_reason === "max_tokens" ? "length" : "stop",
    };
  }

  async embedText(_input: string): Promise<number[]> {
    // Anthropic does not have a public embeddings API.
    // Use OpenAI embeddings or a local model for this.
    throw new Error(
      "Anthropic does not provide an embeddings API. Configure a separate embeddings provider."
    );
  }

  countTokens(input: string): number {
    return Math.ceil(input.length / 4);
  }

  async listModels(): Promise<LLMModel[]> {
    return [
      {
        id: "claude-opus-4-5",
        name: "Claude Opus 4.5",
        contextWindow: 200000,
        supportsEmbeddings: false,
      },
      {
        id: "claude-sonnet-4-5",
        name: "Claude Sonnet 4.5",
        contextWindow: 200000,
        supportsEmbeddings: false,
      },
      {
        id: "claude-3-5-haiku-20241022",
        name: "Claude Haiku 3.5",
        contextWindow: 200000,
        supportsEmbeddings: false,
      },
    ];
  }

  async validateKey(apiKey: string): Promise<boolean> {
    try {
      const res = await fetch(`${ANTHROPIC_API_URL}/models`, {
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
