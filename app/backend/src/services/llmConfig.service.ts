import { prisma } from "../db/prisma.js";
import { AppError, ErrorCode } from "@dnd/shared";
import { encrypt, decrypt, maskKey } from "../crypto/encryption.js";
import { env } from "../config/env.js";
import type { LlmProvider } from "@dnd/domain";

export const llmConfigService = {
  async list() {
    const configs = await prisma.llmConfig.findMany({
      orderBy: { createdAt: "desc" },
    });

    // Never return encrypted key — return safe representation
    return configs.map((c: any) => ({
      id: c.id,
      provider: c.provider,
      model: c.model,
      isActive: c.isActive,
      hasApiKey: !!c.apiKeyEncrypted,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  },

  async upsert(provider: LlmProvider, model: string, apiKey?: string) {
    const existing = await prisma.llmConfig.findFirst({ where: { provider } });

    const apiKeyEncrypted = apiKey
      ? encrypt(apiKey, env.ENCRYPTION_KEY)
      : existing?.apiKeyEncrypted ?? null;

    if (existing) {
      return prisma.llmConfig.update({
        where: { id: existing.id },
        data: { model, apiKeyEncrypted },
        select: { id: true, provider: true, model: true, isActive: true },
      });
    }

    return prisma.llmConfig.create({
      data: { provider, model, apiKeyEncrypted, isActive: false },
      select: { id: true, provider: true, model: true, isActive: true },
    });
  },

  async activate(id: string) {
    // Only one config active at a time
    await prisma.llmConfig.updateMany({ data: { isActive: false } });
    return prisma.llmConfig.update({
      where: { id },
      data: { isActive: true },
      select: { id: true, provider: true, model: true, isActive: true },
    });
  },

  async getActiveKey(): Promise<{ provider: string; model: string; apiKey: string | null }> {
    const config = await prisma.llmConfig.findFirst({ where: { isActive: true } });
    if (!config) throw AppError.notFound(ErrorCode.LLM_CONFIG_NOT_FOUND, "No active LLM config");

    const apiKey = config.apiKeyEncrypted
      ? decrypt(config.apiKeyEncrypted, env.ENCRYPTION_KEY)
      : null;

    return { provider: config.provider, model: config.model, apiKey };
  },

  async validateKey(provider: LlmProvider, apiKey: string): Promise<boolean> {
    // Each provider has a lightweight validation endpoint
    try {
      if (provider === "openai") {
        const res = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        return res.ok;
      }
      if (provider === "anthropic") {
        const res = await fetch("https://api.anthropic.com/v1/models", {
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
        });
        return res.ok;
      }
      // For ollama (local), just check if server responds
      if (provider === "ollama") {
        const res = await fetch("http://localhost:11434/api/tags");
        return res.ok;
      }
      return false;
    } catch {
      return false;
    }
  },
};
