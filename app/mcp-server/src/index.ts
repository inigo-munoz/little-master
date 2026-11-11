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

import { buildServer } from "./server.js";

const PORT = Number(process.env["PORT"] ?? 3002);
const HOST = process.env["HOST"] ?? "127.0.0.1";
const ALLOWED_HOSTS = (process.env["ALLOWED_HOSTS"] ?? "127.0.0.1,localhost,::1").split(",");

const server = await buildServer({
  allowedHosts: ALLOWED_HOSTS,
  backendUrl: process.env["BACKEND_URL"],
});

await server.listen({ port: PORT, host: HOST });
server.log.info(`MCP server running at http://${HOST}:${PORT}`);
