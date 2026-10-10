import {
  IMonevAttendanceProvider,
  IMonevAuthProvider,
  MonevAuthMechanismType,
} from "./provider-interface";
import { officialMonevProvider, MonevFetchResult } from "./official-provider";
import { attendanceRepository, DbAttendanceRecord } from "../db/database";
import { MONEV_API_BASE_URL } from "./auth-investigation";

/**
 * 1. Provider Langsung Server-to-Server (Backend Direct API)
 * Digunakan saat server MAA memiliki kredensial resmi (Personal Access Token / Service Token)
 */
export class ServerDirectAttendanceProvider implements IMonevAttendanceProvider {
  readonly id = "server-direct";
  readonly name = "Monev Direct Server API";
  readonly description = "Memanggil API https://monev-api.maganghub.kemnaker.go.id langsung dari server Node.js.";
  readonly mechanismType: MonevAuthMechanismType = "DIRECT_SERVER_CREDENTIALS";

  isConfigured(): boolean {
    return officialMonevProvider.isEnabled;
  }

  async fetchAttendances(
    participantId: string,
    startDate: string,
    endDate: string,
    options?: { token?: string }
  ): Promise<MonevFetchResult> {
    return officialMonevProvider.fetchAttendances(
      participantId,
      startDate,
      endDate,
      options?.token
    );
  }
}

/**
 * 2. Provider Database Lokal Terverifikasi (Local Synced Repository)
 * Menyediakan data presensi yang telah diverifikasi dan tersimpan di database lokal pengguna
 */
export class DatabaseSyncedAttendanceProvider implements IMonevAttendanceProvider {
  readonly id = "db-synced";
  readonly name = "Verified Local Attendance Store";
  readonly description = "Membaca catatan presensi Monev asli yang telah terverifikasi dan disimpan di database lokal.";
  readonly mechanismType: MonevAuthMechanismType = "BROWSER_COMPANION_BRIDGE";

  isConfigured(): boolean {
    return true;
  }

  async fetchAttendances(
    participantId: string,
    startDate: string,
    endDate: string
  ): Promise<MonevFetchResult> {
    // Cari record di repository
    const records = attendanceRepository.findByUserAndDateRange(
      participantId,
      startDate,
      endDate
    );

    return {
      success: true,
      statusCode: 200,
      records: records.map((r) => ({
        date: r.attendance_date,
        status: r.status,
        approval_status: r.approval_status,
        notes: r.notes || undefined,
        created_at: r.source_updated_at || undefined,
      })),
      message: `Berhasil membaca ${records.length} data absensi dari penyimpanan lokal terverifikasi.`,
    };
  }
}

/**
 * 3. Provider Autentikasi SSO Resmi Kemnaker
 */
export class KemnakerSsoAuthProvider implements IMonevAuthProvider {
  readonly id = "kemnaker-sso";
  readonly name = "SIAPkerja Kemnaker SSO";
  readonly mechanismType: MonevAuthMechanismType = "OFFICIAL_SSO_REDIRECT";

  isAvailable(): boolean {
    return true;
  }

  async getLoginInitiateUrl(): Promise<string | null> {
    try {
      const res = await fetch(`${MONEV_API_BASE_URL}/api/v1/auth/login`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const text = await res.text();
        return text.trim();
      }
      return null;
    } catch {
      return null;
    }
  }
}

/**
 * Registry Terpusat Penyedia Integrasi Monev
 * Memastikan Dashboard & Service Monitoring dapat beralih antar provider tanpa menulis ulang UI.
 */
class MonevProviderRegistryClass {
  private attendanceProviders: Map<string, IMonevAttendanceProvider> = new Map();
  private authProviders: Map<string, IMonevAuthProvider> = new Map();

  constructor() {
    this.registerAttendanceProvider(new ServerDirectAttendanceProvider());
    this.registerAttendanceProvider(new DatabaseSyncedAttendanceProvider());
    this.registerAuthProvider(new KemnakerSsoAuthProvider());
  }

  registerAttendanceProvider(provider: IMonevAttendanceProvider): void {
    this.attendanceProviders.set(provider.id, provider);
  }

  registerAuthProvider(provider: IMonevAuthProvider): void {
    this.authProviders.set(provider.id, provider);
  }

  /**
   * Mendapatkan Provider Presensi Aktif:
   * Mengutamakan Server Direct jika kredensial backend dikonfigurasi,
   * atau beralih ke Database Synced Store.
   */
  getActiveAttendanceProvider(): IMonevAttendanceProvider {
    const direct = this.attendanceProviders.get("server-direct");
    if (direct && direct.isConfigured()) {
      return direct;
    }
    return (
      this.attendanceProviders.get("db-synced") ||
      new DatabaseSyncedAttendanceProvider()
    );
  }

  getAttendanceProvider(id: string): IMonevAttendanceProvider | undefined {
    return this.attendanceProviders.get(id);
  }

  getAllAttendanceProviders(): IMonevAttendanceProvider[] {
    return Array.from(this.attendanceProviders.values());
  }

  getActiveAuthProvider(): IMonevAuthProvider {
    return (
      this.authProviders.get("kemnaker-sso") ||
      new KemnakerSsoAuthProvider()
    );
  }
}

export const monevProviderRegistry = new MonevProviderRegistryClass();
