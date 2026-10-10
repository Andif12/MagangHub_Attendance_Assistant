import { MonevFetchResult, RawAttendanceItem } from "./official-provider";

export interface MonevUserProfile {
  id: string;
  name: string;
  email: string;
  participantId?: string;
}

export type MonevAuthMechanismType =
  | "DIRECT_SERVER_CREDENTIALS" // Token server resmi di env
  | "OFFICIAL_SSO_REDIRECT"      // Alur SSO SIAPkerja Kemnaker
  | "BROWSER_COMPANION_BRIDGE";  // Companion Extension di browser

/**
 * Kontrak Interface Penyedia Data Presensi Monev (Attendance Provider)
 * Memisahkan dashboard dan sistem pemantauan dari mekanisme autentikasi atau transport data.
 */
export interface IMonevAttendanceProvider {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly mechanismType: MonevAuthMechanismType;

  /**
   * Mengecek apakah provider ini siap digunakan (kredensial / sesi valid)
   */
  isConfigured(): boolean;

  /**
   * Mengambil riwayat absensi asli peserta
   */
  fetchAttendances(
    participantId: string,
    startDate: string,
    endDate: string,
    options?: { token?: string }
  ): Promise<MonevFetchResult>;

  /**
   * Mengambil profil pengguna yang terautentikasi (jika didukung)
   */
  fetchProfile?(options?: { token?: string }): Promise<MonevUserProfile | null>;
}

/**
 * Kontrak Interface Penyedia Autentikasi Monev (Auth Provider)
 * Menangani inisiasi login, callback, dan verifikasi sesi.
 */
export interface IMonevAuthProvider {
  readonly id: string;
  readonly name: string;
  readonly mechanismType: MonevAuthMechanismType;

  /**
   * Apakah metode autentikasi ini saat ini dapat dijalankan
   */
  isAvailable(): boolean;

  /**
   * Menghasilkan URL inisiasi login ke portal resmi jika berbasis redirect
   */
  getLoginInitiateUrl?(): Promise<string | null>;

  /**
   * Menangani pertukaran kode otorisasi (jika callback didukung)
   */
  exchangeAuthorizationCode?(code: string, state: string): Promise<{
    success: boolean;
    token?: string;
    user?: MonevUserProfile;
    error?: string;
  }>;
}
