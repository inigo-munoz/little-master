// Typed error codes used across backend and surfaced to frontend.
// Frontend should never show raw error messages — map codes to UI strings.

export const ErrorCode = {
  // Generic
  INTERNAL_ERROR: "INTERNAL_ERROR",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",

  // Campaigns
  CAMPAIGN_NOT_FOUND: "CAMPAIGN_NOT_FOUND",
  CAMPAIGN_DUPLICATE: "CAMPAIGN_DUPLICATE",

  // Sessions
  SESSION_NOT_FOUND: "SESSION_NOT_FOUND",

  // NPCs
  NPC_NOT_FOUND: "NPC_NOT_FOUND",

  // Documents
  DOCUMENT_NOT_FOUND: "DOCUMENT_NOT_FOUND",
  DOCUMENT_TOO_LARGE: "DOCUMENT_TOO_LARGE",
  DOCUMENT_UNSUPPORTED_FORMAT: "DOCUMENT_UNSUPPORTED_FORMAT",

  // Rules
  RULE_SOURCE_NOT_FOUND: "RULE_SOURCE_NOT_FOUND",
  RULES_CONFLICT: "RULES_CONFLICT",

  // LLM / Providers
  LLM_CONFIG_NOT_FOUND: "LLM_CONFIG_NOT_FOUND",
  LLM_PROVIDER_ERROR: "LLM_PROVIDER_ERROR",
  LLM_INVALID_API_KEY: "LLM_INVALID_API_KEY",
  LLM_RATE_LIMIT: "LLM_RATE_LIMIT",
  LLM_CONTEXT_TOO_LARGE: "LLM_CONTEXT_TOO_LARGE",

  // MCP
  MCP_TOOL_NOT_FOUND: "MCP_TOOL_NOT_FOUND",
  MCP_TOOL_EXECUTION_ERROR: "MCP_TOOL_EXECUTION_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }

  static notFound(code: ErrorCode, message: string): AppError {
    return new AppError(code, message, 404);
  }

  static validation(message: string, details?: unknown): AppError {
    return new AppError(ErrorCode.VALIDATION_ERROR, message, 400, details);
  }

  static forbidden(message: string): AppError {
    return new AppError(ErrorCode.FORBIDDEN, message, 403);
  }
}
