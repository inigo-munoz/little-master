import { z } from "zod";

// ─── Core Interface ───────────────────────────────────────────────────────────
// All LLM providers must implement this interface.
// Backend routes to concrete implementations at runtime based on active config.

export interface LLMProvider {
  readonly name: string;
  generateText(input: PromptInput): Promise<LLMTextResponse>;
  embedText(input: string): Promise<number[]>;
  countTokens(input: string): number; // approximate
  listModels(): Promise<LLMModel[]>;
  validateKey(apiKey: string): Promise<boolean>;
}

// ─── Message Types ────────────────────────────────────────────────────────────
export const MessageRoleSchema = z.enum(["system", "user", "assistant"]);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

export interface Message {
  role: MessageRole;
  content: string;
}

// ─── Prompt Input ─────────────────────────────────────────────────────────────
export interface PromptInput {
  messages: Message[];
  systemPrompt?: string;
  temperature?: number;   // 0–1, default 0.7
  maxTokens?: number;     // default 2048
  model?: string;         // override active model
}

// ─── Responses ────────────────────────────────────────────────────────────────
export interface LLMTextResponse {
  content: string;
  tokensUsed: number;
  model: string;
  finishReason: "stop" | "length" | "error";
}

export interface LLMModel {
  id: string;
  name: string;
  contextWindow: number;
  supportsEmbeddings: boolean;
}

// ─── Context chunk with source metadata ──────────────────────────────────────
// This is what gets injected into prompts — never raw documents
export interface ContextChunk {
  id: string;
  content: string;
  sourceType: string;
  authorityLevel: string;
  documentTitle: string;
  chunkIndex: number;
  relevanceScore: number;
}

// ─── Assistant modes ──────────────────────────────────────────────────────────
// Single source of truth: @dnd/domain — re-exported here for consumer convenience
export { AssistantModeSchema, type AssistantMode } from "@dnd/domain";
