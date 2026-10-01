import { z } from "zod";

/**
 * Campos opcionales de atribución para las rutas de actualización (PATCH).
 * Siguen la convención de POST /api/npcs: el cliente envía "assistant" y el
 * changelog lo registra como "ai". Por defecto "user", para no alterar a los
 * llamadores existentes.
 */
export const AttributionFields = {
  authorType: z.enum(["user", "assistant"]).default("user"),
  reason: z.string().min(1).max(1000).optional(),
} as const;

export interface ChangelogAttribution {
  authorType: "user" | "ai";
  source: "user" | "ai_assistant";
  reason: string;
}

export function resolveAttribution(
  authorType: "user" | "assistant",
  reason: string | undefined,
  defaultReason: string
): ChangelogAttribution {
  const isAi = authorType === "assistant";
  return {
    authorType: isAi ? "ai" : "user",
    source: isAi ? "ai_assistant" : "user",
    reason: reason ?? defaultReason,
  };
}
