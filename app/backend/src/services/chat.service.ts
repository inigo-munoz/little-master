import { prisma } from "../db/prisma.js";
import { llmConfigService } from "./llmConfig.service.js";
import { createProvider } from "@dnd/llm-providers";
import { SYSTEM_PROMPTS } from "@dnd/llm-providers";
import type { AssistantMode } from "@dnd/domain";
import type { ContextChunk } from "@dnd/llm-providers";
import type { Message } from "@dnd/llm-providers";
import { AppError, ErrorCode } from "@dnd/shared";
import { mcpService } from "./mcp.service.js";

// Modos que se benefician del estado de campaña inyectado automáticamente
const MODES_WITH_CAMPAIGN_STATE: AssistantMode[] = ["session_director", "designer"];

interface ChatInput {
  campaignId?: string;
  mode: AssistantMode;
  messages: Message[];
  maxContextChunks?: number;
}

export const chatService = {
  async chat(input: ChatInput) {
    // 1. Get active LLM config (throws if none)
    const { provider, model, apiKey, authMethod, accountId } = await llmConfigService.getActiveKey();
    if (!apiKey) {
      throw new AppError(
        ErrorCode.LLM_INVALID_API_KEY,
        "No API key configured for the active provider",
        400
      );
    }

    // 2. Retrieve relevant context chunks from the campaign
    const contextChunks = input.campaignId
      ? await this.retrieveContext(
          input.campaignId,
          this.extractUserQuery(input.messages),
          input.maxContextChunks ?? 8
        )
      : [];

    // 3. Obtener estado de campaña directamente de la BD para modos que lo
    // necesitan (antes pasaba por el MCP server vía HTTP, que en desktop no
    // está arrancado y pagaba timeout en cada chat)
    const toolsUsed: string[] = [];
    let campaignStateContext = "";

    if (input.campaignId && MODES_WITH_CAMPAIGN_STATE.includes(input.mode)) {
      try {
        const state = await mcpService.getCampaignState(input.campaignId);
        campaignStateContext = mcpService.formatCampaignState(state);
        toolsUsed.push("get_campaign_state");
      } catch (err: unknown) {
        // El chat continúa sin estado de campaña, pero el fallo queda logueado
        const message = err instanceof Error ? err.message : String(err);
        console.warn(
          `[chat] No se pudo obtener el estado de la campaña ${input.campaignId} (modo ${input.mode}): ${message}`
        );
      }
    }

    // 4. Build augmented system prompt and messages
    const baseSystemPrompt = SYSTEM_PROMPTS[input.mode];
    const systemPromptWithState = campaignStateContext
      ? `${baseSystemPrompt}\n\n${campaignStateContext}`
      : baseSystemPrompt;

    const systemPrompt = input.mode === "rule_reviewer"
      ? SYSTEM_PROMPTS[input.mode]
      : this.buildSystemPrompt(systemPromptWithState, contextChunks);

    const augmentedMessages = this.buildAugmentedMessages(
      input.messages,
      contextChunks,
      input.mode
    );

    // 5. Call the LLM (with OAuth token auto-refresh on 401)
    const callLlm = (key: string) =>
      createProvider(provider as Parameters<typeof createProvider>[0], key, model, { accountId }).generateText({
        messages: augmentedMessages,
        systemPrompt,
        temperature: input.mode === "rule_reviewer" ? 0.1 : 0.7,
        maxTokens: 2048,
      });

    let response;
    try {
      response = await callLlm(apiKey);
    } catch (err) {
      const isInvalidKey = err instanceof Error && err.message.startsWith("INVALID_API_KEY:");
      if (isInvalidKey && authMethod === "oauth") {
        const refreshed = await llmConfigService.forceRefreshActiveKey();
        if (!refreshed) throw err;
        response = await callLlm(refreshed);
      } else {
        throw err;
      }
    }

    // 6. Log the run — every AI action is auditable
    const llmConfig = await prisma.llmConfig.findFirst({ where: { isActive: true } });
    await prisma.assistantRun.create({
      data: {
        campaignId: input.campaignId ?? null,
        mode: input.mode,
        prompt: this.extractUserQuery(input.messages),
        response: response.content,
        contextChunks: JSON.stringify(contextChunks.map((c) => c.id)),
        toolsUsed: JSON.stringify(toolsUsed),
        tokensUsed: response.tokensUsed,
        llmConfigId: llmConfig?.id ?? null,
      },
    });

    return {
      content: response.content,
      contextChunks,
      tokensUsed: response.tokensUsed,
      model: response.model,
      mode: input.mode,
      toolsUsed,
    };
  },

  extractUserQuery(messages: Message[]): string {
    // Last user message is the query for context retrieval
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    return lastUser?.content ?? "";
  },

  buildAugmentedMessages(messages: Message[], chunks: ContextChunk[], mode: string): Message[] {
    if (chunks.length === 0) return messages;

    if (mode === "rule_reviewer") {
      // For rule_reviewer: prepend context as a system-like user message with strict XML tags
      const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
      const sorted = [...chunks].sort((a, b) => {
        return (order[a.authorityLevel] ?? 2) -
               (order[b.authorityLevel] ?? 2);
      });

      const contextBlock = sorted.map((c, i) =>
        `<document index="${i + 1}" source="${c.sourceType}" authority="${c.authorityLevel}" title="${c.documentTitle}">
${c.content}
</document>`
      ).join("\n\n");

      const contextMessage: Message = {
        role: "user",
        content: `<RETRIEVED_DOCUMENTS>
These are the ONLY documents you may use to answer. Do not use any other knowledge.
If the answer is not in these documents, say "Esta regla no está en los documentos indexados actuales."

${contextBlock}
</RETRIEVED_DOCUMENTS>

Understood. I will only answer from the documents above and will explicitly flag anything not found in them.`,
      };

      // Insert context exchange before the last user message
      const allButLast = messages.slice(0, -1);
      const lastMessage = messages[messages.length - 1]!;

      const ackMessage: Message = { role: "assistant", content: "Understood. I will only answer from the documents above and will explicitly flag anything not found in them." };

      return [...allButLast, { role: "user", content: contextMessage.content.split("\n\nUnderstood")[0] + "\n</RETRIEVED_DOCUMENTS>" }, ackMessage, lastMessage];
    }

    // For other modes: use the traditional system prompt injection
    return messages;
  },

  buildSystemPrompt(basePrompt: string, chunks: ContextChunk[]): string {
    if (chunks.length === 0) return basePrompt;

    const contextSection = chunks
      .sort((a, b) => {
        const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
        return (
          (order[a.authorityLevel] ?? 2) -
          (order[b.authorityLevel] ?? 2)
        );
      })
      .map(
        (c, i) =>
          `[CONTEXT ${i + 1}] [source: ${c.sourceType}] [authority: ${c.authorityLevel}] [doc: ${c.documentTitle}]\n${c.content}`
      )
      .join("\n\n---\n\n");

    return `${basePrompt}

═══════════════════════════════════════════════
RETRIEVED CONTEXT (use this to answer — do not invent facts not present here)
Source authority in this context follows the hierarchy defined in your role.
═══════════════════════════════════════════════

${contextSection}

═══════════════════════════════════════════════`;
  },

  async retrieveContext(
    campaignId: string,
    query: string,
    maxChunks: number
  ): Promise<ContextChunk[]> {
    if (!query.trim()) return [];

    const { embeddingService } = await import("./embedding.service.js");

    try {
      const results = await embeddingService.search({
        query,
        campaignId,
        limit: maxChunks,
        minScore: 0.25,
      });

      if (results.length > 0) return results;
    } catch {
      // Embedding not available — fall back to keyword
    }

    // Keyword fallback when no embeddings exist yet
    const tokens = query.split(" ").slice(0, 3).join(" ");
    const chunks = await prisma.documentChunk.findMany({
      where: {
        OR: [{ campaignId }, { campaignId: null }],
        content: { contains: tokens },
      },
      include: { document: { select: { title: true } } },
      take: maxChunks,
    });

    return chunks.map((c: typeof chunks[number]) => ({
      id: c.id,
      content: c.content,
      sourceType: c.sourceType,
      authorityLevel: c.authorityLevel,
      documentTitle: c.document.title,
      chunkIndex: c.chunkIndex,
      relevanceScore: 0.5,
      rawSimilarity: 0.5,
    }));
  },
};
