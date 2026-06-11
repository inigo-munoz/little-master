import { createServer, type Server } from "node:http";
import { URL } from "node:url";
import crypto from "node:crypto";
import { prisma } from "../db/prisma.js";
import { encrypt, decrypt } from "../crypto/encryption.js";
import { env } from "../config/env.js";

const OPENAI_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const OPENAI_AUTH_URL = "https://auth.openai.com/oauth/authorize";
const OPENAI_TOKEN_URL = "https://auth.openai.com/oauth/token";
const CALLBACK_PORT = 1455;
const CALLBACK_PATH = "/auth/callback";
const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}${CALLBACK_PATH}`;

interface PendingOAuth {
  state: string;
  codeVerifier: string;
  server: Server;
  resolved: boolean;
}

let pendingOAuth: PendingOAuth | null = null;

function base64url(buffer: Buffer): string {
  return buffer.toString("base64url");
}

function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = base64url(crypto.randomBytes(32));
  const codeChallenge = base64url(
    crypto.createHash("sha256").update(codeVerifier).digest()
  );
  return { codeVerifier, codeChallenge };
}

function successHtml(): string {
  return `<!DOCTYPE html><html><head><title>Autenticación exitosa</title>
<style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#1c1917;color:#e7e5e4}
.box{text-align:center;padding:2rem}.ok{color:#34d399;font-size:2rem;margin-bottom:1rem}</style></head>
<body><div class="box"><div class="ok">✓</div><h2>Conectado con OpenAI</h2><p>Podés cerrar esta pestaña y volver al asistente.</p></div></body></html>`;
}

function errorHtml(msg: string): string {
  return `<!DOCTYPE html><html><head><title>Error</title>
<style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#1c1917;color:#e7e5e4}
.box{text-align:center;padding:2rem}.err{color:#f87171;font-size:2rem;margin-bottom:1rem}</style></head>
<body><div class="box"><div class="err">✗</div><h2>Error de autenticación</h2><p>${msg}</p></div></body></html>`;
}

export const oauthService = {
  async startOAuth(): Promise<{ authUrl: string }> {
    if (pendingOAuth) {
      pendingOAuth.server.close();
      pendingOAuth = null;
    }

    const { codeVerifier, codeChallenge } = generatePKCE();
    const state = base64url(crypto.randomBytes(16));

    const server = await new Promise<Server>((resolve, reject) => {
      const srv = createServer(async (req, res) => {
        if (!req.url?.startsWith(CALLBACK_PATH)) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }

        const url = new URL(req.url, `http://127.0.0.1:${CALLBACK_PORT}`);
        const code = url.searchParams.get("code");
        const returnedState = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        if (error || !pendingOAuth || pendingOAuth.resolved) {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(errorHtml(error ?? "OAuth session expired"));
          return;
        }

        if (returnedState !== pendingOAuth.state) {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(errorHtml("State mismatch — possible CSRF"));
          return;
        }

        if (!code) {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(errorHtml("No authorization code received"));
          return;
        }

        try {
          await exchangeCodeForTokens(code, pendingOAuth.codeVerifier);
          pendingOAuth.resolved = true;
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(successHtml());
        } catch (err: unknown) {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(errorHtml(err instanceof Error ? err.message : "Token exchange failed"));
        } finally {
          setTimeout(() => {
            srv.close();
            if (pendingOAuth?.server === srv) pendingOAuth = null;
          }, 2000);
        }
      });

      srv.on("error", reject);
      srv.listen(CALLBACK_PORT, "localhost", () => resolve(srv));
    });

    const params = new URLSearchParams({
      client_id: OPENAI_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: "openid profile email offline_access api.connectors.read api.connectors.invoke",
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      codex_cli_simplified_flow: "true",
    });

    const authUrl = `${OPENAI_AUTH_URL}?${params}`;

    pendingOAuth = { state, codeVerifier, server, resolved: false };

    setTimeout(() => {
      if (pendingOAuth?.server === server && !pendingOAuth.resolved) {
        server.close();
        pendingOAuth = null;
      }
    }, 5 * 60 * 1000);

    return { authUrl };
  },

  async getOAuthStatus(): Promise<{ connected: boolean; provider: string | null; expiresAt: string | null; model: string | null }> {
    const config = await prisma.llmConfig.findFirst({
      where: { provider: "openai-codex" },
      select: { oauthAccessToken: true, oauthExpiresAt: true, provider: true, model: true },
    });

    if (!config?.oauthAccessToken) {
      return { connected: false, provider: null, expiresAt: null, model: null };
    }

    return {
      connected: true,
      provider: config.provider,
      expiresAt: config.oauthExpiresAt?.toISOString() ?? null,
      model: config.model,
    };
  },

  async disconnectOAuth(): Promise<void> {
    await prisma.llmConfig.updateMany({
      where: { provider: "openai-codex" },
      data: {
        oauthAccessToken: null,
        oauthRefreshToken: null,
        oauthExpiresAt: null,
        isActive: false,
        keyIsValid: null,
        keyValidatedAt: null,
      },
    });
  },

  async refreshTokenIfNeeded(configId: string, force = false): Promise<string | null> {
    const config = await prisma.llmConfig.findUnique({ where: { id: configId } });
    if (!config?.oauthAccessToken || !config.oauthRefreshToken) return null;

    const accessToken = decrypt(config.oauthAccessToken, env.ENCRYPTION_KEY);

    if (!force && config.oauthExpiresAt && config.oauthExpiresAt.getTime() > Date.now() + 60_000) {
      return accessToken;
    }

    const refreshToken = decrypt(config.oauthRefreshToken, env.ENCRYPTION_KEY);

    const res = await fetch(OPENAI_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: OPENAI_CLIENT_ID,
        refresh_token: refreshToken,
      }),
    });

    if (!res.ok) return null;

    const tokens = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      id_token?: string;
    };

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : new Date(Date.now() + 3600_000);

    const newAccountId = extractChatGptAccountId(tokens.id_token);

    await prisma.llmConfig.update({
      where: { id: configId },
      data: {
        oauthAccessToken: encrypt(tokens.access_token, env.ENCRYPTION_KEY),
        oauthRefreshToken: tokens.refresh_token
          ? encrypt(tokens.refresh_token, env.ENCRYPTION_KEY)
          : config.oauthRefreshToken,
        oauthExpiresAt: expiresAt,
        ...(newAccountId ? { oauthAccountId: newAccountId } : {}),
        keyIsValid: true,
        keyValidatedAt: new Date(),
      },
    });

    return tokens.access_token;
  },
};

function extractChatGptAccountId(idToken: string | undefined): string | null {
  if (!idToken) return null;
  try {
    const payload = idToken.split(".")[1];
    if (!payload) return null;
    const decoded = Buffer.from(payload, "base64url").toString("utf-8");
    const claims = JSON.parse(decoded) as Record<string, unknown>;
    const auth = claims["https://api.openai.com/auth"] as Record<string, unknown> | undefined;
    return (auth?.["chatgpt_account_id"] as string | undefined) ?? null;
  } catch {
    return null;
  }
}

async function exchangeCodeForTokens(code: string, codeVerifier: string): Promise<void> {
  const res = await fetch(OPENAI_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: OPENAI_CLIENT_ID,
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: codeVerifier,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${body}`);
  }

  const tokens = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type: string;
    id_token?: string;
  };

  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000)
    : new Date(Date.now() + 3600_000);

  const existing = await prisma.llmConfig.findFirst({
    where: { provider: "openai-codex" },
  });

  const accountId = extractChatGptAccountId((tokens as { id_token?: string }).id_token);

  const tokenData = {
    authMethod: "oauth",
    oauthAccessToken: encrypt(tokens.access_token, env.ENCRYPTION_KEY),
    oauthRefreshToken: tokens.refresh_token
      ? encrypt(tokens.refresh_token, env.ENCRYPTION_KEY)
      : null,
    oauthExpiresAt: expiresAt,
    oauthAccountId: accountId ?? null,
    keyIsValid: true,
    keyValidatedAt: new Date(),
    isActive: true,
  };

  if (existing) {
    // No machacamos `model`: el usuario pudo haberlo cambiado vía PATCH /oauth/model
    await prisma.llmConfig.update({ where: { id: existing.id }, data: tokenData });
  } else {
    await prisma.llmConfig.create({
      data: { provider: "openai-codex", model: "gpt-5.4", ...tokenData },
    });
  }

  await prisma.llmConfig.updateMany({
    where: { NOT: { authMethod: "oauth" } },
    data: { isActive: false },
  });
}
