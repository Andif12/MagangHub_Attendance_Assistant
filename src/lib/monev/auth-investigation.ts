import { MonevInvestigationStatus } from "@/types";

export const OFFICIAL_MONEV_LOGIN_URL = "https://monev.maganghub.kemnaker.go.id/login";
export const MONEV_API_BASE_URL = "https://monev-api.maganghub.kemnaker.go.id";

export function redactSensitive(input: string): string {
  if (!input) return "";
  return input
    .replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, "$1[REDACTED]")
    .replace(/(token=)[A-Za-z0-9._-]+/gi, "$1[REDACTED]")
    .replace(/(cookie:\s*)[^\r\n]+/gi, "$1[REDACTED]")
    .replace(/(authorization:\s*)[^\r\n]+/gi, "$1[REDACTED]");
}

export function maskParticipantId(participantId?: string): string {
  if (!participantId || participantId.trim() === "") {
    return "[Belum Dikonfigurasi]";
  }
  const clean = participantId.trim();
  if (clean.length <= 4) {
    return "****";
  }
  return `***${clean.slice(-4)}`;
}

export async function investigateMonevAuth(): Promise<MonevInvestigationStatus> {
  const hasServerCredentials = Boolean(
    process.env.MONEV_API_ENABLED === "true" &&
    process.env.MONEV_AUTH_TOKEN &&
    process.env.MONEV_PARTICIPANT_ID
  );

  if (hasServerCredentials) {
    return {
      state: "REAL_CONNECTED",
      targetHost: MONEV_API_BASE_URL,
      endpoint: "/api/v1/attendances",
      hasOfficialOAuth: false,
      corsRestricted: false,
      cookieIsolated: false,
      summary: "Koneksi server resmi terkonfigurasi melalui variabel lingkungan backend.",
      technicalDetails: {
        browserSecurityExplanation: "Permintaan dikirim langsung melalui server runtime Node.js.",
        kemnakerPolicyExplanation: "Menggunakan kredensial resmi server yang sah.",
        supportedPathExplanation: "Server backend memanggil API Monev Kemnaker secara langsung.",
      },
    };
  }

  return {
    state: "BLOCKED",
    targetHost: MONEV_API_BASE_URL,
    endpoint: "/api/v1/attendances",
    hasOfficialOAuth: false,
    corsRestricted: true,
    cookieIsolated: true,
    summary:
      "Aplikasi web tidak dapat membaca sesi login browser dari portal Kemnaker secara otomatis karena diblokir oleh Same-Origin Policy (SOP) dan ketiadaan OAuth 2.0 publik.",
    technicalDetails: {
      browserSecurityExplanation:
        "Sesuai spesifikasi keamanan browser W3C, cookie sesi yang Anda peroleh saat login di portal Monev disimpan di domain kemnaker.go.id dan diisolasi sehingga tidak dapat diakses oleh website eksternal.",
      kemnakerPolicyExplanation:
        "Kementerian Ketenagakerjaan RI belum menerbitkan OAuth 2.0 Authorization Server publik bagi pengembang aplikasi pihak ketiga.",
      supportedPathExplanation:
        "Jalur integrasi yang didukung tanpa menyalin token atau mencuri cookie adalah menggunakan MAA Companion Web Extension dengan host_permissions resmi atau kredensial server resmi.",
    },
  };
}
