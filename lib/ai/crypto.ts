import "server-only";

// ============================================================================
// Encriptación AES-256-GCM para la API key de OpenAI.
// La master key se lee de AI_ENCRYPTION_KEY (32 bytes hex = 64 chars).
// ============================================================================

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits

function getMasterKey(): Buffer {
  const hex = process.env.AI_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "AI_ENCRYPTION_KEY no está configurada o no tiene 64 caracteres hex. " +
        "Genera una con: openssl rand -hex 32",
    );
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encripta un texto plano con AES-256-GCM.
 * @returns String en formato `iv:authTag:ciphertext` (hex)
 */
export function encrypt(plaintext: string): string {
  const key = getMasterKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Desencripta un string previamente encriptado con `encrypt()`.
 */
export function decrypt(encryptedStr: string): string {
  const parts = encryptedStr.split(":");
  if (parts.length !== 3) {
    throw new Error("Formato de encriptación inválido");
  }

  const [ivHex, authTagHex, ciphertext] = parts;
  const key = getMasterKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
