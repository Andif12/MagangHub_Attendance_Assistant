import { describe, it, expect } from "vitest";
import { encryptSecret, decryptSecret, getEncryptionKey } from "@/lib/auth/encryption";
import crypto from "crypto";

describe("MAA Authenticated Secret Encryption (AES-256-GCM)", () => {
  const validHexKey = crypto.randomBytes(32).toString("hex");
  const alternateHexKey = crypto.randomBytes(32).toString("hex");

  it("1. Berhasil melakukan enkripsi dan dekripsi dengan kunci yang benar", () => {
    const secretMessage = "official_kemnaker_service_token_xyz_12345";
    const encrypted = encryptSecret(secretMessage, validHexKey);

    expect(encrypted.version).toBe("v1");
    expect(encrypted.packed).toMatch(/^v1:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/);

    const decrypted = decryptSecret(encrypted.packed, validHexKey);
    expect(decrypted).toBe(secretMessage);
  });

  it("2. Menolak dekripsi dengan error saat menggunakan kunci yang salah", () => {
    const secretMessage = "confidential_api_secret";
    const encrypted = encryptSecret(secretMessage, validHexKey);

    expect(() => {
      decryptSecret(encrypted.packed, alternateHexKey);
    }).toThrow(/Dekripsi gagal: integritas data rusak atau kunci salah/);
  });

  it("3. Menolak dekripsi saat ciphertext dimanipulasi (Tamper Protection)", () => {
    const secretMessage = "secure_token_payload";
    const encrypted = encryptSecret(secretMessage, validHexKey);

    const parts = encrypted.packed.split(":");
    // Ganti 2 karakter terakhir dari ciphertext
    const tamperedCiphertext = parts[3].slice(0, -2) + "aa";
    const tamperedPacked = `${parts[0]}:${parts[1]}:${parts[2]}:${tamperedCiphertext}`;

    expect(() => {
      decryptSecret(tamperedPacked, validHexKey);
    }).toThrow(/Dekripsi gagal/);
  });

  it("4. Menolak dekripsi saat Auth Tag dimanipulasi", () => {
    const secretMessage = "another_secret";
    const encrypted = encryptSecret(secretMessage, validHexKey);

    const parts = encrypted.packed.split(":");
    // Ganti 2 karakter terakhir dari authTag
    const tamperedTag = parts[2].slice(0, -2) + "bb";
    const tamperedPacked = `${parts[0]}:${parts[1]}:${tamperedTag}:${parts[3]}`;

    expect(() => {
      decryptSecret(tamperedPacked, validHexKey);
    }).toThrow(/Dekripsi gagal/);
  });

  it("5. Menolak input kosong atau format tidak valid", () => {
    expect(() => encryptSecret("", validHexKey)).toThrow(/tidak boleh kosong/);
    expect(() => decryptSecret("", validHexKey)).toThrow(/tidak boleh kosong/);
    expect(() => decryptSecret("invalid:format", validHexKey)).toThrow(/Format ciphertext tidak valid/);
    expect(() => decryptSecret("v2:12:34:56", validHexKey)).toThrow(/Versi enkripsi 'v2' tidak didukung/);
  });

  it("6. Menghasilkan nonce/IV unik setiap kali enkripsi dijalankan pada plaintext yang sama", () => {
    const plaintext = "static_token";
    const enc1 = encryptSecret(plaintext, validHexKey);
    const enc2 = encryptSecret(plaintext, validHexKey);

    expect(enc1.iv).not.toBe(enc2.iv);
    expect(enc1.ciphertext).not.toBe(enc2.ciphertext);
    expect(enc1.packed).not.toBe(enc2.packed);

    // Keduanya tetap berhasil didekripsi ke teks asal
    expect(decryptSecret(enc1.packed, validHexKey)).toBe(plaintext);
    expect(decryptSecret(enc2.packed, validHexKey)).toBe(plaintext);
  });
});
