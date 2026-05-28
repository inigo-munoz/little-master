import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { resolve, join, dirname, sep } from "node:path";
import { homedir } from "node:os";
import { promises as fs } from "node:fs";
import {
  verifyVault,
  importFromVault,
  exportToVault,
  saveVaultPath,
} from "../services/obsidian.service.js";
import { prisma } from "../db/prisma.js";
import { AppError, ErrorCode } from "@dnd/shared";

const isWindows = process.platform === "win32";

/**
 * Verifica que una ruta esté dentro de los directorios permitidos para la
 * navegación del vault: home del usuario y puntos de montaje del sistema.
 * Previene path traversal (CWE-22) resolviendo la ruta y comprobando el prefijo.
 * Retorna la ruta resuelta (absoluta y normalizada).
 */
function validateVaultPath(dirPath: string): string {
  const resolved = resolve(dirPath);

  const allowedBases: string[] = [homedir()];

  if (process.platform === "linux") {
    allowedBases.push("/media", "/mnt");
  } else if (process.platform === "darwin") {
    allowedBases.push("/Volumes");
  } else if (process.platform === "win32") {
    // Permite cualquier raíz de unidad: C:\, D:\, etc.
    for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
      allowedBases.push(`${letter}:\\`);
    }
  }

  const isAllowed = allowedBases.some(
    (base) => resolved === base || resolved.startsWith(base + sep)
  );

  if (!isAllowed) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      "Path is outside the allowed scope",
      400
    );
  }

  return resolved;
}

export const obsidianRoutes: FastifyPluginAsync = async (server) => {
  // -- Browse filesystem (cross-platform) ------------------------------------
  server.get<{ Querystring: { path?: string } }>("/browse", async (request) => {
    const { path: dirPath } = z
      .object({ path: z.string().optional() })
      .parse(request.query);

    // Valida y resuelve la ruta antes de cualquier operación de filesystem (CWE-22).
    // Si dirPath está fuera del scope permitido, validateVaultPath lanza AppError 400
    // que escapa del try/catch y es manejado por el errorHandler global de Fastify.
    const targetPath = dirPath ? validateVaultPath(dirPath) : homedir();

    try {
      const entries = await fs.readdir(targetPath, { withFileTypes: true });

      // Check if this dir is itself a vault
      const isVault = entries.some(e => e.name === ".obsidian");

      // List subdirectories (show hidden on all platforms for .obsidian detection)
      const subDirs = await Promise.all(
        entries
          .filter(e => e.isDirectory() && e.name !== ".obsidian")
          .filter(e => !["$Recycle.Bin", "System Volume Information", "pagefile.sys"].includes(e.name))
          .map(async (e) => {
            const subPath = join(targetPath, e.name);
            let subIsVault = false;
            try {
              const subEntries = await fs.readdir(subPath);
              subIsVault = subEntries.includes(".obsidian");
            } catch (err) {
              request.log.warn({ path: subPath, err }, "Cannot read subdirectory during vault detection — skipping");
            }
            return {
              name: e.name,
              path: subPath,
              isVault: subIsVault,
              hidden: e.name.startsWith("."),
            };
          })
      );

      // Sort: vaults first, then alphabetically, hidden last
      subDirs.sort((a, b) => {
        if (a.isVault && !b.isVault) return -1;
        if (!a.isVault && b.isVault) return 1;
        if (a.hidden && !b.hidden) return 1;
        if (!a.hidden && b.hidden) return -1;
        return a.name.localeCompare(b.name);
      });

      // Build breadcrumb
      const parts = targetPath.split(sep).filter(Boolean);
      const breadcrumb = [];

      if (!isWindows) {
        breadcrumb.push({ name: "/", path: "/" });
      }

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]!;
        const fullPath = isWindows
          ? parts.slice(0, i + 1).join(sep)
          : sep + parts.slice(0, i + 1).join(sep);
        breadcrumb.push({ name: part, path: fullPath });
      }

      // Common quick-access locations
      const quickAccess: { name: string; path: string }[] = [
        { name: " Home", path: homedir() },
      ];

      // On Linux, add common mount points
      if (process.platform === "linux") {
        try {
          const mediaEntries = await fs.readdir("/media", { withFileTypes: true });
          for (const e of mediaEntries) {
            if (e.isDirectory()) {
              const userMedia = join("/media", e.name);
              const userEntries = await fs.readdir(userMedia, { withFileTypes: true }).catch(() => []);
              for (const drive of userEntries) {
                if (drive.isDirectory()) {
                  quickAccess.push({
                    name: `[Drive] ${drive.name}`,
                    path: join(userMedia, drive.name),
                  });
                }
              }
            }
          }
        } catch (err) {
          request.log.warn({ err }, "Cannot enumerate /media mount points — skipping Linux drive detection");
        }
      }

      // On Windows, list drive letters
      if (isWindows) {
        for (const letter of "CDEFGHIJKLMNOPQRSTUVWXYZ") {
          const drivePath = letter + ":\\";
          try {
            await fs.access(drivePath);
            quickAccess.push({ name: `[Drive] ${letter}:`, path: drivePath });
          } catch {
            // Drive letter does not exist — expected when probing all letters
          }
        }
      }

      // On Mac, add Volumes
      if (process.platform === "darwin") {
        try {
          const volumes = await fs.readdir("/Volumes", { withFileTypes: true });
          for (const v of volumes) {
            if (v.isDirectory()) {
              quickAccess.push({ name: `[Drive] ${v.name}`, path: `/Volumes/${v.name}` });
            }
          }
        } catch (err) {
          request.log.warn({ err }, "Cannot enumerate /Volumes mount points — skipping macOS volume detection");
        }
      }

      return {
        success: true,
        data: {
          current: targetPath,
          parent: dirname(targetPath),
          isVault,
          dirs: subDirs,
          breadcrumb,
          quickAccess,
          platform: process.platform,
        },
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: { code: "BROWSE_ERROR", message: `Cannot read directory: ${msg}` },
      };
    }
  });


  // -- Get current vault config -----------------------------------------------
  server.get("/config", async () => {
    const setting = await prisma.appSetting.findUnique({
      where: { key: "obsidian_vault_path" },
    });
    return {
      success: true,
      data: { vaultPath: setting?.value ?? null },
    };
  });

  // -- Save vault path --------------------------------------------------------
  server.post<{ Body: unknown }>("/config", async (request) => {
    const { vaultPath } = z
      .object({ vaultPath: z.string().min(1) })
      .parse(request.body);

    await saveVaultPath(vaultPath);
    return { success: true, data: { vaultPath } };
  });

  // -- Verify vault structure -------------------------------------------------
  server.post<{ Body: unknown }>("/verify", async (request) => {
    const { vaultPath } = z
      .object({ vaultPath: z.string().min(1) })
      .parse(request.body);

    const result = await verifyVault(vaultPath);
    return { success: true, data: result };
  });

  // -- Scan vault (preview before import)
  server.post<{ Body: unknown }>("/scan", async (request, reply) => {
    const { vaultPath: bodyPath } = z
      .object({ vaultPath: z.string().optional() })
      .parse(request.body ?? {});

    const setting = await prisma.appSetting.findUnique({ where: { key: "obsidian_vault_path" } });
    const vaultPath = bodyPath ?? setting?.value;

    if (!vaultPath) {
      return reply.status(400).send({
        success: false,
        error: { code: "NO_VAULT_PATH", message: "No vault path configured." },
      });
    }

    const { scanVault } = await import("../services/obsidian.service.js");
    const result = await scanVault(vaultPath);
    return { success: true, data: result };
  });

  // -- Import from vault ------------------------------------------------------
  server.post<{ Body: unknown }>("/import", async (request, reply) => {
    const { campaignId } = z
      .object({ campaignId: z.string() })
      .parse(request.body);

    const setting = await prisma.appSetting.findUnique({
      where: { key: "obsidian_vault_path" },
    });

    if (!setting?.value) {
      return reply.status(400).send({
        success: false,
        error: { code: "NO_VAULT_PATH", message: "No vault path configured. Set it in Settings first." },
      });
    }

    const result = await importFromVault(setting.value, campaignId);
    return { success: true, data: result };
  });

  // -- Export to vault --------------------------------------------------------
  server.post<{ Body: unknown }>("/export", async (request, reply) => {
    const { campaignId } = z
      .object({ campaignId: z.string() })
      .parse(request.body);

    const setting = await prisma.appSetting.findUnique({
      where: { key: "obsidian_vault_path" },
    });

    if (!setting?.value) {
      return reply.status(400).send({
        success: false,
        error: { code: "NO_VAULT_PATH", message: "No vault path configured. Set it in Settings first." },
      });
    }

    const result = await exportToVault(setting.value, campaignId);
    return { success: true, data: result };
  });
};
