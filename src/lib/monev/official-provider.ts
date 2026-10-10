import {
  MONEV_API_BASE_URL,
  maskParticipantId,
  redactSensitive,
} from "./auth-investigation";

export interface RawAttendanceItem {
  date: string;
  status: string;
  approval_status?: string | null;
  created_at?: string;
  updated_at?: string;
  notes?: string;
}

export interface MonevFetchResult {
  success: boolean;
  statusCode: number;
  records: RawAttendanceItem[];
  errorCode?: string;
  message: string;
}

export class OfficialMonevProvider {
  readonly baseUrl = MONEV_API_BASE_URL;

  get isEnabled(): boolean {
    return Boolean(
      process.env.MONEV_API_ENABLED === "true" &&
      process.env.MONEV_AUTH_TOKEN &&
      process.env.MONEV_PARTICIPANT_ID
    );
  }

  get participantIdMasked(): string {
    return maskParticipantId(process.env.MONEV_PARTICIPANT_ID);
  }

  async fetchAttendances(
    participantId: string,
    startDate: string,
    endDate: string,
    tokenOverride?: string
  ): Promise<MonevFetchResult> {
    const token = tokenOverride || process.env.MONEV_AUTH_TOKEN;

    if (!token) {
      return {
        success: false,
        statusCode: 401,
        records: [],
        errorCode: "AUTH_REQUIRED",
        message: "Kredensial otorisasi Monev Kemnaker belum tersedia.",
      };
    }

    const url = new URL("/api/v1/attendances", this.baseUrl);
    url.searchParams.set("participant_id", participantId);
    url.searchParams.set("start_date", startDate);
    url.searchParams.set("end_date", endDate);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.status === 401 || res.status === 403) {
        return {
          success: false,
          statusCode: res.status,
          records: [],
          errorCode: "AUTH_FAILED",
          message: `Autentikasi ke server Monev ditolak (HTTP ${res.status}). Sesi tidak valid atau telah kedaluwarsa.`,
        };
      }

      if (res.status === 429) {
        return {
          success: false,
          statusCode: 429,
          records: [],
          errorCode: "RATE_LIMITED",
          message: "Batas permintaan server Monev tercapai (HTTP 429). Silakan tunggu sejenak.",
        };
      }

      if (!res.ok) {
        return {
          success: false,
          statusCode: res.status,
          records: [],
          errorCode: "SERVER_ERROR",
          message: `Server Monev mengembalikan respon galat (HTTP ${res.status} ${res.statusText}).`,
        };
      }

      const json = (await res.json()) as { data?: RawAttendanceItem[] };
      const rawRecords = Array.isArray(json?.data) ? json.data : [];

      return {
        success: true,
        statusCode: 200,
        records: rawRecords,
        message: `Berhasil membaca ${rawRecords.length} catatan absensi asli dari Monev.`,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gangguan koneksi ke Monev API.";
      return {
        success: false,
        statusCode: 0,
        records: [],
        errorCode: "CONNECTION_ERROR",
        message: redactSensitive(msg),
      };
    }
  }
}

export const officialMonevProvider = new OfficialMonevProvider();
