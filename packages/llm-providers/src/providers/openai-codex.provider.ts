import type { LLMProvider, PromptInput, LLMTextResponse, LLMModel } from "../types/index.js";

const CODEX_URL = "https://chatgpt.com/backend-api/codex/responses";

interface CodexContentPart {
  type: "input_text" | "output_text";
  text: string;
}

interface CodexMessage {
  role: string;
  content: CodexContentPart[];
}

interface CodexResponseDonePayload {
  type: "response.done";
  response: {
    id: string;
    model: string;
    output: Array<{
      content: CodexContentPart[];
    }>;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      total_tokens?: number;
    };
  };
}

export class OpenAICodexProvider implements LLMProvider {
  readonly name = "openai-codex";

  constructor(
    private readonly accessToken: string,
    private readonly defaultModel: string = "gpt-5.4",
    private readonly accountId?: string
  ) {}

  async generateText(input: PromptInput): Promise<LLMTextResponse> {
    const model = input.model ?? this.defaultModel;

    const codexMessages: CodexMessage[] = input.messages.map((m) => ({
      role: m.role,
      content: [
        {
          type: m.role === "assistant" ? "output_text" : "input_text",
          text: m.content,
        },
      ],
    }));

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.accessToken}`,
      "OpenAI-Beta": "responses=experimental",
      "Accept": "text/event-stream",
      "originator": "codex_cli_rs",
    };

    if (this.accountId) {
      headers["chatgpt-account-id"] = this.accountId;
    }

    const body: Record<string, unknown> = {
      model,
      stream: true,
      store: false,
      input: codexMessages,
      instructions: input.systemPrompt ?? "",
    };

    const res = await fetch(CODEX_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 401) {
        throw Object.assign(
          new Error("INVALID_API_KEY: ChatGPT OAuth token expired or invalid"),
          { code: "INVALID_API_KEY", provider: "openai-codex" }
        );
      }
      if (res.status === 403) {
        throw new Error(
          "OpenAI Codex requires an active ChatGPT Plus or Pro subscription"
        );
      }
      if (res.status === 400) {
        let detail = text;
        try {
          const parsed = JSON.parse(text) as { detail?: string };
          if (parsed.detail) detail = parsed.detail;
        } catch { /* keep raw text */ }
        throw new Error(`CODEX_ERROR: ${detail}`);
      }
      throw new Error(`Codex API error ${res.status}: ${text}`);
    }

    const { text: content, totalTokens } = await parseCodexStream(res);

    return {
      content,
      tokensUsed: totalTokens,
      model,
      finishReason: "stop",
    };
  }

  async embedText(_input: string): Promise<number[]> {
    throw new Error(
      "OpenAI Codex (ChatGPT OAuth) does not support embeddings. Configure a dedicated OpenAI API key for semantic search."
    );
  }

  countTokens(input: string): number {
    return Math.ceil(input.length / 4);
  }

  async listModels(): Promise<LLMModel[]> {
    return [
      {
        id: "gpt-5.4",
        name: "GPT-5.4",
        contextWindow: 1050000,
        supportsEmbeddings: false,
      },
      {
        id: "gpt-5.3-codex",
        name: "GPT-5.3 Codex",
        contextWindow: 272000,
        supportsEmbeddings: false,
      },
      {
        id: "gpt-5.1-codex-mini",
        name: "GPT-5.1 Codex Mini",
        contextWindow: 262000,
        supportsEmbeddings: false,
      },
    ];
  }

  async validateKey(_apiKey: string): Promise<boolean> {
    return true;
  }
}

async function parseCodexStream(
  res: Response
): Promise<{ text: string; totalTokens: number }> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body from Codex API");

  const decoder = new TextDecoder();
  let buffer = "";
  let resultText = "";
  let totalTokens = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (raw === "[DONE]") continue;

        let event: unknown;
        try {
          event = JSON.parse(raw);
        } catch {
          continue;
        }

        if (
          typeof event === "object" &&
          event !== null &&
          "type" in event &&
          (event as { type: string }).type === "response.done"
        ) {
          const payload = event as CodexResponseDonePayload;
          totalTokens = payload.response.usage?.total_tokens ?? 0;
          for (const item of payload.response.output ?? []) {
            for (const part of item.content ?? []) {
              if (part.type === "output_text") {
                resultText += part.text;
              }
            }
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!resultText) {
    throw new Error(
      "Codex API returned an empty response. Make sure your ChatGPT Plus/Pro subscription is active."
    );
  }

  return { text: resultText, totalTokens };
}
