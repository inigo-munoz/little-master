import type { LLMProvider } from "../types/index.js";
import { OpenAIProvider } from "./openai.provider.js";
import { AnthropicProvider } from "./anthropic.provider.js";
import { OpenAICodexProvider } from "./openai-codex.provider.js";

export type SupportedProvider = "openai" | "anthropic" | "openrouter" | "ollama" | "openai-codex";

export function createProvider(
  provider: SupportedProvider,
  apiKey: string,
  model: string,
  options?: { accountId?: string }
): LLMProvider {
  switch (provider) {
    case "openai":
      return new OpenAIProvider(apiKey, model);
    case "openai-codex":
      return new OpenAICodexProvider(apiKey, model, options?.accountId);
    case "anthropic":
      return new AnthropicProvider(apiKey, model);
    case "openrouter":
      return new OpenAIProvider(apiKey, model); // TODO: extend with base URL override
    case "ollama":
      throw new Error("Ollama provider not yet implemented");
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
