import { prisma } from "../db/prisma.js";
import { AppError, ErrorCode } from "@dnd/shared";
import { encrypt, decrypt } from "../crypto/encryption.js";
import { env } from "../config/env.js";
import { oauthService } from "./oauth.service.js";
import type { LlmProvider } from "@dnd/domain";

export const llmConfigService = {
  async list() {
    const configs = await prisma.llmConfig.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        assistantRuns: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
      },
    });

    return configs.map((c: typeof configs[number]) => ({
      id: c.id,
      provider: c.provider,
      model: c.model,
      authMethod: c.authMethod,
      isActive: c.isActive,
      hasApiKey: !!c.apiKeyEncrypted,
      hasOAuth: !!c.oauthAccessToken,
      keyIsValid: c.keyIsValid,
      keyValidatedAt: c.keyValidatedAt,
      lastUsedAt: c.assistantRuns[0]?.createdAt ?? null,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  },

  async upsert(provider: LlmProvider, model: string, apiKey?: string) {
    const existing = await prisma.llmConfig.findFirst({ where: { provider } });

    let apiKeyEncrypted = existing?.apiKeyEncrypted ?? null;
    let keyIsValid: boolean | null = existing?.keyIsValid ?? null;
    let keyValidatedAt: Date | null = existing?.keyValidatedAt ?? null;

    if (apiKey) {
      const valid = await this.validateKey(provider, apiKey);
      if (!valid) {
        throw new AppError(
          ErrorCode.LLM_INVALID_API_KEY,
          `API key validation failed for ${provider}. Check the key and try again.`,
          422
        );
      }
      apiKeyEncrypted = encrypt(apiKey, env.ENCRYPTION_KEY);
      keyIsValid = true;
      keyValidatedAt = new Date();
    }

    if (existing) {
      return prisma.llmConfig.update({
        where: { id: existing.id },
        data: { model, apiKeyEncrypted, keyIsValid, keyValidatedAt },
        select: { id: true, provider: true, model: true, isActive: true },
      });
    }

    return prisma.llmConfig.create({
      data: { provider, model, apiKeyEncrypted, isActive: false, keyIsValid, keyValidatedAt },
      select: { id: true, provider: true, model: true, isActive: true },
    });
  },

  async activate(id: string) {
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

    if (config.authMethod === "oauth" && config.oauthAccessToken) {
      const token = await oauthService.refreshTokenIfNeeded(config.id);
      return { provider: config.provider, model: config.model, apiKey: token };
    }

    const apiKey = config.apiKeyEncrypted
      ? decrypt(config.apiKeyEncrypted, env.ENCRYPTION_KEY)
      : null;

    return { provider: config.provider, model: config.model, apiKey };
  },

  async validateKey(provider: LlmProvider, apiKey: string): Promise<boolean> {
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
      if (provider === "openrouter") {
        const res = await fetch("https://openrouter.ai/api/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        return res.ok;
      }
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
