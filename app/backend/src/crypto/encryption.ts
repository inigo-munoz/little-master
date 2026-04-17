/**
 * Encryption module for API keys.
 *
 * Uses AES-256-GCM (authenticated encryption — prevents tampering).
 * The ENCRYPTION_KEY comes from env and should eventually come from OS keychain.
 *
 * KDF versions:
 *   v1 (legacy) — SHA-256 hash sin sal. Formato: "<iv>:<authTag>:<encrypted>" (3 partes).
 *   v2 (actual) — PBKDF2-SHA256 con sal aleatoria por registro. Formato: "v2:<salt>:<iv>:<authTag>:<encrypted>" (5 partes).
 *
 * decrypt() detecta automáticamente el formato para mantener compatibilidad con
 * registros existentes cifrados con v1. Los nuevos encrypt() siempre generan v2.
 *
 * Rules:
 * - Never log the plaintext key or the decrypted value
 * - Never return the decrypted key to the frontend
 * - Never store the plaintext key in the database
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
  pbkdf2Sync,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_DIGEST = "sha256";

/** KDF v1 (legacy) — sin sal. Solo para descifrar registros antiguos. */
function deriveKeyV1(rawKey: string): Buffer {
  return createHash("sha256").update(rawKey).digest();
}

/** KDF v2 — PBKDF2 con sal aleatoria por registro. */
function deriveKeyV2(rawKey: string, salt: Buffer): Buffer {
  return pbkdf2Sync(rawKey, salt, PBKDF2_ITERATIONS, KEY_LENGTH, PBKDF2_DIGEST);
}

export function encrypt(plaintext: string, encryptionKey: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const key = deriveKeyV2(encryptionKey, salt);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Format v2: v2:salt:iv:authTag:encrypted (all hex)
  return [
    "v2",
    salt.toString("hex"),
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

export function decrypt(ciphertext: string, encryptionKey: string): string {
  const parts = ciphertext.split(":");

  if (parts.length === 5 && parts[0] === "v2") {
    // Formato v2: v2:salt:iv:authTag:encrypted
    const [, saltHex, ivHex, authTagHex, encryptedHex] = parts as [string, string, string, string, string];
    const key = deriveKeyV2(encryptionKey, Buffer.from(saltHex, "hex"));
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
    return decipher.update(Buffer.from(encryptedHex, "hex")).toString("utf8") + decipher.final("utf8");
  }

  if (parts.length === 3) {
    // Formato v1 (legacy): iv:authTag:encrypted
    const [ivHex, authTagHex, encryptedHex] = parts as [string, string, string];
    const key = deriveKeyV1(encryptionKey);
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
    return decipher.update(Buffer.from(encryptedHex, "hex")).toString("utf8") + decipher.final("utf8");
  }

  throw new Error("Invalid ciphertext format");
}

export function maskKey(key: string): string {
  if (key.length <= 8) return "***";
  return key.slice(0, 4) + "***" + key.slice(-4);
}
