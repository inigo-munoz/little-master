/**
 * MCP server app factory: routes, Host guard and CORS, without binding a port, so the
 * server can be exercised in tests with `inject`. `index.ts` builds it and listens.
 */

import Fastify from "fastify";
import cors from "@fastify/cors";
import { FORBIDDEN_HOST_RESPONSE, isAllowedHost, toAllowedHostSet } from "@dnd/shared";
import { TOOL_MAP, ALL_TOOLS } from "./tools/index.js";

export interface BuildServerOptions {
  /** Hostnames accepted in the Host header (loopback by default). */
  allowedHosts: Iterable<string>;
  logger?: boolean;
  backendUrl?: string;
}

export async function buildServer(options: BuildServerOptions) {
  const server = Fastify({ logger: options.logger === false ? false : { level: "info" } });

  // DNS-rebinding defense, same as the backend. Without it a rebound page could run
  // write tools here, and this server would forward them to the backend with a valid
  // loopback Host, bypassing the backend's own guard.
  const allowed = toAllowedHostSet(options.allowedHosts);
  server.addHook("onRequest", async (request, reply) => {
    if (!isAllowedHost(request.headers.host, allowed)) {
      return reply.status(403).send(FORBIDDEN_HOST_RESPONSE);
    }
  });

  await server.register(cors, {
    origin: options.backendUrl ?? "http://127.0.0.1:3001",
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
        // The full error stays in the log; callers only learn that the tool failed
        request.log.error({ err, tool: tool.name }, "Tool execution failed");
        return reply.status(500).send({
          success: false,
          error: "Tool execution failed",
          tool: tool.name,
        });
      }
    }
  );

  // ── Health ────────────────────────────────────────────────────────────────────
  server.get("/health", async () => ({ status: "ok", service: "mcp-server" }));

  return server;
}

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
