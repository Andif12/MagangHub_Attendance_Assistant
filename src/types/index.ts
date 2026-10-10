// Model tipe data untuk MagangHub Attendance Assistant (MAA)

export interface User {
  id: string;
  name: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export type SafeUser = Omit<User, "password_hash">;

export type AttendanceNativeStatus =
  | "PRESENT"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "ABSENT"
  | "HOLIDAY"
  | "OFF"
  | "NOT_DETECTED"
  | "UNKNOWN";

export type AttendanceApprovalStatus =
  | "APPROVED"
  | "PENDING"
  | "REJECTED"
  | null;

export type MonevEightStatus =
  | "HADIR_DISETUJUI"      // Hadir disetujui
  | "IZIN_DISETUJUI"       // Izin disetujui
  | "TIDAK_HADIR"          // Tidak Hadir
  | "KEHADIRAN_DITOLAK"    // Kehadiran Ditolak
  | "PERLU_TINDAKAN"       // Perlu Tindakan Anda
  | "MENUNGGU_MENTOR"      // Menunggu Tindakan Mentor
  | "BELUM_DIISI"          // Belum Diisi
  | "HARI_LIBUR";          // Hari Libur

export interface ScheduledDayStatus {
  date: string; // YYYY-MM-DD
  dayName: string; // Senin, Selasa, dll
  formattedDate: string; // 9 Okt 2026
  isWorkday: boolean;
  category: MonevEightStatus;
  categoryLabel: string;
  badgeStyle: {
    bg: string;
    text: string;
    border: string;
    dot: string;
  };
  record?: AttendanceRecord;
  checkInTime?: string;
  reviewTime?: string;
  notes?: string;
  needsAction: boolean;
}

export interface AttendanceRecord {
  id: string;
  user_id: string;
  attendance_date: string; // YYYY-MM-DD
  status: string;
  approval_status: AttendanceApprovalStatus;
  source: string;
  source_updated_at?: string | null;
  last_checked_at: string;
  raw_response?: string | null;
  notes?: string | null;
}

export type SyncResultStatus = "SUCCESS" | "FAILED" | "BLOCKED" | "PARTIAL";

export interface SyncRun {
  id: string;
  user_id: string;
  started_at: string;
  completed_at: string | null;
  result: SyncResultStatus;
  error_code: string | null;
  records_checked: number;
  message: string | null;
}

export type NotificationType =
  | "ATTENDANCE_MISSING"
  | "STATUS_CHANGED"
  | "SYNC_FAILED"
  | "SYSTEM";

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  message: string;
  is_read: number;
  created_at: string;
}

export interface NotificationPreference {
  id: string;
  user_id: string;
  enabled: number;
  channel: string;
  settings: string;
  updated_at: string;
}

export type MonevConnectionState =
  | "REAL_CONNECTED"
  | "BLOCKED"
  | "UNVERIFIED";

export interface MonevInvestigationStatus {
  state: MonevConnectionState;
  targetHost: string;
  endpoint: string;
  hasOfficialOAuth: boolean;
  corsRestricted: boolean;
  cookieIsolated: boolean;
  summary: string;
  technicalDetails: {
    browserSecurityExplanation: string;
    kemnakerPolicyExplanation: string;
    supportedPathExplanation: string;
  };
}
