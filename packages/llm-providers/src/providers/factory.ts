import type { LLMProvider } from "../types/index.js";
import { OpenAIProvider } from "./openai.provider.js";
import { AnthropicProvider } from "./anthropic.provider.js";

export type SupportedProvider = "openai" | "anthropic" | "openrouter" | "ollama";

export function createProvider(
  provider: SupportedProvider,
  apiKey: string,
  model: string
): LLMProvider {
  switch (provider) {
    case "openai":
      return new OpenAIProvider(apiKey, model);
    case "anthropic":
      return new AnthropicProvider(apiKey, model);
    case "openrouter":
      // OpenRouter is OpenAI-compatible — reuse the adapter with a different base URL
      return new OpenAIProvider(apiKey, model); // TODO: extend with base URL override
    case "ollama":
      // TODO: OllamaProvider (Sprint 3)
      throw new Error("Ollama provider not yet implemented");
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
