/**
 * MCP Server
 *
 * Exposes campaign tools as a local HTTP service.
 * The backend calls these endpoints when the LLM requests a tool execution.
 *
 * Architecture note: This is intentionally separate from the backend.
 * Tools here are thin — they validate input and delegate to the backend API.
 * No direct DB access. No business logic. Clean boundary.
 */

import { config } from "dotenv";
config();

import Fastify from "fastify";
import cors from "@fastify/cors";
import { TOOL_MAP, ALL_TOOLS } from "./tools/index.js";

const server = Fastify({
  logger: { level: "info" },
});

const PORT = Number(process.env["PORT"] ?? 3002);
const HOST = process.env["HOST"] ?? "127.0.0.1";

await server.register(cors, {
  origin: process.env["BACKEND_URL"] ?? "http://127.0.0.1:3001",
});

// ── List available tools (used by backend to inject into LLM context) ─────────
server.get("/tools", async () => {
  return {
    tools: ALL_TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: zodToJsonSchema(t.inputSchema),
    })),
  };
});

// ── Execute a tool ─────────────────────────────────────────────────────────────
server.post<{ Params: { toolName: string }; Body: unknown }>(
  "/tools/:toolName",
  async (request, reply) => {
    const tool = TOOL_MAP.get(request.params.toolName);

    if (!tool) {
      return reply.status(404).send({
        error: `Tool '${request.params.toolName}' not found`,
        availableTools: ALL_TOOLS.map((t) => t.name),
      });
    }

    // Validate input against tool's schema
    const parseResult = tool.inputSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: "Invalid tool input",
        details: parseResult.error.format(),
      });
    }

    try {
      const result = await tool.execute(parseResult.data);
      return { success: true, data: result };
    } catch (err) {
      request.log.error({ err, tool: tool.name }, "Tool execution failed");
      return reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : "Tool execution failed",
        tool: tool.name,
      });
    }
  }
);

// ── Health ────────────────────────────────────────────────────────────────────
server.get("/health", async () => ({ status: "ok", service: "mcp-server" }));

// ── Minimal Zod → JSON Schema conversion (avoids adding zod-to-json-schema dep) ──
function zodToJsonSchema(schema: any): object {
  // For MVP: return the shape description from Zod's _def
  // Sprint 2: replace with zod-to-json-schema package
  try {
    if (schema._def?.typeName === "ZodObject") {
      const shape = schema._def.shape();
      return {
        type: "object",
        properties: Object.fromEntries(
          Object.entries(shape).map(([key, val]: [string, any]) => [
            key,
            { type: inferZodType(val), description: val._def?.description ?? undefined },
          ])
        ),
      };
    }
  } catch {
    // fallback
  }
  return { type: "object" };
}

function inferZodType(zodDef: any): string {
  const name = zodDef?._def?.typeName ?? "";
  if (name.includes("String")) return "string";
  if (name.includes("Number")) return "number";
  if (name.includes("Boolean")) return "boolean";
  if (name.includes("Array")) return "array";
  if (name.includes("Object")) return "object";
  if (name.includes("Optional")) return inferZodType(zodDef._def.innerType);
  return "string";
}

await server.listen({ port: PORT, host: HOST });
server.log.info(`MCP server running at http://${HOST}:${PORT}`);
