import type { LLMProvider } from "../types/index.js";
import { OpenAIProvider } from "./openai.provider.js";
import { AnthropicProvider } from "./anthropic.provider.js";
import { OpenAICodexProvider } from "./openai-codex.provider.js";

// OpenRouter exposes an OpenAI-compatible API; the key must only ever go here.
export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

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
      return new OpenAIProvider(apiKey, model, OPENROUTER_BASE_URL);
    case "ollama":
      throw new Error("Ollama provider not yet implemented");
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
