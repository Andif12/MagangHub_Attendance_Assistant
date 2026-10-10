import { describe, it, expect, beforeEach } from "vitest";
import {
  validatePasswordStrength,
  hashPassword,
  verifyPassword,
} from "@/lib/auth/password";
import {
  createSessionToken,
  verifySessionToken,
} from "@/lib/auth/session";
import { checkRateLimit, resetRateLimiter } from "@/lib/auth/rate-limiter";
import { userRepository } from "@/lib/db/database";
import crypto from "crypto";

describe("MAA Authentication & Security Tests", () => {
  beforeEach(() => {
    resetRateLimiter();
  });

  describe("1. Validasi Kekuatan Kata Sandi", () => {
    it("menolak kata sandi yang kurang dari 8 karakter", () => {
      const res = validatePasswordStrength("Abc1!");
      expect(res.valid).toBe(false);
      expect(res.message).toContain("minimal 8 karakter");
    });

    it("menolak kata sandi tanpa perpaduan huruf besar, kecil, dan angka", () => {
      expect(validatePasswordStrength("hanyakecil123").valid).toBe(false);
      expect(validatePasswordStrength("HANYABESAR123").valid).toBe(false);
      expect(validatePasswordStrength("HurufBesarKecil").valid).toBe(false);
    });

    it("menerima kata sandi yang memenuhi kriteria keamanan", () => {
      expect(validatePasswordStrength("MagangHub2026!").valid).toBe(true);
      expect(validatePasswordStrength("K3mnakerMaa#Secure").valid).toBe(true);
    });
  });

  describe("2. Hashing Password (Bcrypt) & Verifikasi", () => {
    it("menghasilkan hash yang berbeda (salted) untuk kata sandi yang sama", async () => {
      const pass = "PasswordKu123";
      const hash1 = await hashPassword(pass);
      const hash2 = await hashPassword(pass);

      expect(hash1).not.toBe(pass);
      expect(hash1).not.toBe(hash2);
      expect(hash1.startsWith("$2a$") || hash1.startsWith("$2b$")).toBe(true);
    });

    it("memverifikasi kata sandi yang cocok dan menolak yang salah", async () => {
      const pass = "KunciRahasia99";
      const hash = await hashPassword(pass);

      const isValid = await verifyPassword(pass, hash);
      const isInvalid = await verifyPassword("SalahKunci99", hash);

      expect(isValid).toBe(true);
      expect(isInvalid).toBe(false);
    });
  });

  describe("3. Manajemen Token Sesi (JWT)", () => {
    it("membuat dan memverifikasi token sesi JWT dengan benar", async () => {
      const payload = {
        userId: "usr_test_123",
        email: "peserta@kemnaker.go.id",
        name: "Budi Magang",
      };

      const token = await createSessionToken(payload);
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3);

      const verified = await verifySessionToken(token);
      expect(verified).not.toBeNull();
      expect(verified?.userId).toBe(payload.userId);
      expect(verified?.email).toBe(payload.email);
      expect(verified?.name).toBe(payload.name);
    });

    it("menolak token sesi yang telah dimanipulasi", async () => {
      const token = await createSessionToken({
        userId: "usr_legit",
        email: "legit@test.com",
        name: "Legit User",
      });

      const tampered = token.slice(0, -5) + "abcde";
      const verified = await verifySessionToken(tampered);
      expect(verified).toBeNull();
    });
  });

  describe("4. Rate Limiting (Proteksi Brute-Force)", () => {
    it("mengizinkan percobaan di bawah ambang batas dan memblokir jika melebihi batas", () => {
      const key = "test_ip_192.168.1.1";

      for (let i = 0; i < 5; i++) {
        const res = checkRateLimit(key, 5, 60_000);
        expect(res.allowed).toBe(true);
      }

      const blocked = checkRateLimit(key, 5, 60_000);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    });
  });

  describe("5. Keamanan Repositori Pengguna (Zero Hash Leakage)", () => {
    it("tidak mengembalikan password_hash pada SafeUser hasil create dan findById", async () => {
      const email = `test-${crypto.randomUUID()}@example.com`;
      const hash = await hashPassword("ValidPass123");
      const userId = crypto.randomUUID();

      const created = userRepository.create({
        id: userId,
        name: "Test User",
        email,
        password_hash: hash,
      });

      expect((created as unknown as { password_hash?: string }).password_hash).toBeUndefined();
      expect(created.email).toBe(email);

      const found = userRepository.findById(userId);
      expect(found).not.toBeNull();
      expect((found as unknown as { password_hash?: string })?.password_hash).toBeUndefined();
    });
  });
});
