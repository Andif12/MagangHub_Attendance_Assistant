import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit nonce standar untuk GCM
const AUTH_TAG_LENGTH = 16; // 128-bit authentication tag
const VERSION_PREFIX = "v1";

/**
 * Mengambil dan memvalidasi encryption key dari environment atau parameter.
 * Kunci harus 32 bytes (256-bit). Dapat berupa string 64-karakter hex atau 32-karakter raw.
 */
export function getEncryptionKey(overrideKey?: string): Buffer {
  const rawKey = overrideKey || process.env.BOT_MONEV_ENCRYPTION_KEY;
  if (!rawKey || typeof rawKey !== "string") {
    throw new Error("BOT_MONEV_ENCRYPTION_KEY tidak ditemukan atau belum dikonfigurasi.");
  }

  const clean = rawKey.trim();

  // Jika berupa 64 hex characters (32 bytes)
  if (/^[0-9a-fA-F]{64}$/.test(clean)) {
    return Buffer.from(clean, "hex");
  }

  // Jika berupa base64 dengan panjang decode 32 bytes
  try {
    const b64 = Buffer.from(clean, "base64");
    if (b64.length === 32) {
      return b64;
    }
  } catch {}

  // Jika berupa UTF-8 string tepat 32 bytes
  const utf8Buf = Buffer.from(clean, "utf-8");
  if (utf8Buf.length === 32) {
    return utf8Buf;
  }

  // Jika panjang tidak tepat 32 bytes, turunkan hash SHA-256 deterministik untuk memastikan 32 bytes
  return crypto.createHash("sha256").update(clean).digest();
}

export interface EncryptedPayload {
  version: string;
  iv: string; // hex
  authTag: string; // hex
  ciphertext: string; // hex
  packed: string; // "v1:{iv}:{authTag}:{ciphertext}"
}

/**
 * Melakukan enkripsi teks menggunakan AES-256-GCM terotentikasi.
 */
export function encryptSecret(plaintext: string, overrideKey?: string): EncryptedPayload {
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    throw new Error("Teks yang akan dienkripsi tidak boleh kosong.");
  }

  const key = getEncryptionKey(overrideKey);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag().toString("hex");
  const ivHex = iv.toString("hex");

  const packed = `${VERSION_PREFIX}:${ivHex}:${authTag}:${encrypted}`;

  return {
    version: VERSION_PREFIX,
    iv: ivHex,
    authTag,
    ciphertext: encrypted,
    packed,
  };
}

/**
 * Melakukan dekripsi teks terenkripsi berformat versi AES-256-GCM.
 */
export function decryptSecret(packedCiphertext: string, overrideKey?: string): string {
  if (!packedCiphertext || typeof packedCiphertext !== "string") {
    throw new Error("Ciphertext tidak boleh kosong.");
  }

  const parts = packedCiphertext.trim().split(":");
  if (parts.length !== 4) {
    throw new Error("Format ciphertext tidak valid. Harus 'v1:iv:authTag:ciphertext'.");
  }

  const [version, ivHex, authTagHex, encryptedHex] = parts;

  if (version !== VERSION_PREFIX) {
    throw new Error(`Versi enkripsi '${version}' tidak didukung.`);
  }

  const key = getEncryptionKey(overrideKey);
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  if (iv.length !== IV_LENGTH) {
    throw new Error("Panjang IV/Nonce tidak valid.");
  }

  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Panjang Auth Tag tidak valid.");
  }

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (err: unknown) {
    throw new Error("Dekripsi gagal: integritas data rusak atau kunci salah.");
  }
}
