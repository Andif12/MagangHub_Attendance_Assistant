import bcrypt from "bcryptjs";

const BCRYPT_SALT_ROUNDS = 12;

export interface PasswordValidationResult {
  valid: boolean;
  message?: string;
}

export function validatePasswordStrength(password: string): PasswordValidationResult {
  if (!password || typeof password !== "string") {
    return { valid: false, message: "Kata sandi tidak boleh kosong." };
  }

  if (password.length < 8) {
    return { valid: false, message: "Kata sandi minimal 8 karakter." };
  }

  if (password.length > 128) {
    return { valid: false, message: "Kata sandi maksimal 128 karakter." };
  }

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  if (!hasLower || !hasUpper || !hasNumber) {
    return {
      valid: false,
      message: "Kata sandi harus mengandung kombinasi huruf besar, huruf kecil, dan angka.",
    };
  }

  return { valid: true };
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) return false;
  return bcrypt.compare(password, hash);
}
