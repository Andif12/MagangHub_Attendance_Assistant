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

    const maxRetries = 2; // Maksimal 2 kali retry untuk error sementara
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= maxRetries) {
      attempt++;
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

        // Kasus 1: Otorisasi Ditolak / Token Kedaluwarsa (HTTP 401 / 403) — JANGAN RETRY
        if (res.status === 401 || res.status === 403) {
          return {
            success: false,
            statusCode: res.status,
            records: [],
            errorCode: "AUTH_FAILED",
            message: `Autentikasi ke server Monev ditolak (HTTP ${res.status}). Sesi tidak valid atau telah kedaluwarsa.`,
          };
        }

        // Kasus 2: Rate Limited (HTTP 429) — JANGAN RETRY AGRESIF
        if (res.status === 429) {
          return {
            success: false,
            statusCode: 429,
            records: [],
            errorCode: "RATE_LIMITED",
            message: "Batas frekuensi permintaan server Monev tercapai (HTTP 429). Silakan tunggu hingga interval berikutnya.",
          };
        }

        // Kasus 3: Server Error Sementara (HTTP 502/503/504) — Boleh retry terbatas
        if (res.status >= 500 && attempt <= maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
          continue;
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
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const isAbort = lastError.name === "AbortError";

        // Jika timeout atau gangguan jaringan dan masih ada jatah retry, tunggu sebentar
        if (attempt <= maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
          continue;
        }

        const msg = isAbort
          ? "Waktu permintaan ke Monev API habis (Timeout 8 detik)."
          : lastError.message || "Gangguan koneksi ke Monev API.";

        return {
          success: false,
          statusCode: 0,
          records: [],
          errorCode: isAbort ? "TIMEOUT_ERROR" : "CONNECTION_ERROR",
          message: redactSensitive(msg),
        };
      }
    }

    return {
      success: false,
      statusCode: 0,
      records: [],
      errorCode: "CONNECTION_ERROR",
      message: redactSensitive(lastError?.message || "Gagal menghubungi server Monev setelah beberapa percobaan."),
    };
  }
}

export const officialMonevProvider = new OfficialMonevProvider();
