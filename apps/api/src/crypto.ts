// Secrets at rest (CLAUDE.md, section 8): AES-256-GCM with a random 96-bit IV per value.
// Stored as "v1:<iv>:<tag>:<ciphertext>" (base64), so the format can change later.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

export interface SecretBox {
  encrypt(plaintext: string): string
  decrypt(stored: string): string
}

/** `key` is 32 bytes, base64-encoded (generate with `openssl rand -base64 32`). */
export function createSecretBox(key: string): SecretBox {
  const keyBytes = Buffer.from(key, "base64")
  if (keyBytes.length !== 32) {
    throw new Error("CREDENTIAL_ENCRYPTION_KEY must be 32 bytes, base64-encoded")
  }
  return {
    encrypt(plaintext) {
      const iv = randomBytes(12)
      const cipher = createCipheriv("aes-256-gcm", keyBytes, iv)
      const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
      const parts = [iv, cipher.getAuthTag(), ciphertext].map((b) => b.toString("base64"))
      return ["v1", ...parts].join(":")
    },
    decrypt(stored) {
      const [version, iv, tag, ciphertext] = stored.split(":")
      if (version !== "v1" || !iv || !tag || !ciphertext) throw new Error("Unknown secret format")
      const decipher = createDecipheriv("aes-256-gcm", keyBytes, Buffer.from(iv, "base64"))
      decipher.setAuthTag(Buffer.from(tag, "base64"))
      return Buffer.concat([
        decipher.update(Buffer.from(ciphertext, "base64")),
        decipher.final(),
      ]).toString("utf8")
    },
  }
}
