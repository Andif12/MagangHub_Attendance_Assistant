import crypto from "crypto";
import {
  attendanceRepository,
  syncRunRepository,
  notificationRepository,
  DbAttendanceRecord,
} from "../db/database";
import { normalizeDateToTimezone } from "../monitoring/attendance-monitor";

export interface ImportedAttendanceItem {
  date: string;
  status: string;
  approval_status?: string | null;
  notes?: string | null;
  raw_response?: string | null;
}

export interface ParseResult {
  valid: ImportedAttendanceItem[];
  errors: string[];
  userInfo?: {
    id?: string;
    name?: string;
    email?: string;
  };
}

/**
 * Validasi dan normalisasi satu item presensi
 */
export function validateAndNormalizeItem(raw: Record<string, unknown>): ImportedAttendanceItem | null {
  // 1. Ekstrak tanggal
  const rawDate = String(raw.date || raw.attendance_date || raw.tanggal || "").trim();
  const dateMatch = rawDate.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!dateMatch) return null;
  const date = dateMatch[1];

  // 2. Ekstrak status kehadiran
  const rawStatus = String(raw.status || raw.kehadiran || "").toUpperCase().trim();
  if (!rawStatus) return null;

  let status = "PRESENT";
  if (/^(PRESENT|HADIR)$/.test(rawStatus)) status = "PRESENT";
  else if (/^(ON_LEAVE|PERMISSION|IZIN|SICK|SAKIT)$/.test(rawStatus)) status = "ON_LEAVE";
  else if (/^(ABSENT|ALPHA|TIDAK_HADIR)$/.test(rawStatus)) status = "ABSENT";
  else if (/^(REJECTED|DITOLAK)$/.test(rawStatus)) status = "REJECTED";
  else if (/^(HOLIDAY|OFF|LIBUR)$/.test(rawStatus)) status = "HOLIDAY";
  else status = rawStatus;

  // 3. Ekstrak status persetujuan mentor
  const rawApproval = String(raw.approval_status || raw.persetujuan || raw.status_persetujuan || "").toUpperCase().trim();
  let approval_status: string | null = null;
  if (/^(APPROVED|DISETUJUI)$/.test(rawApproval)) approval_status = "APPROVED";
  else if (/^(PENDING|MENUNGGU|SUBMITTED|DIAJUKAN)$/.test(rawApproval)) approval_status = "SUBMITTED";
  else if (/^(REJECTED|DITOLAK)$/.test(rawApproval)) approval_status = "REJECTED";
  else if (rawApproval) approval_status = rawApproval;

  // 4. Catatan
  const notes = raw.notes || raw.catatan || raw.keterangan ? String(raw.notes || raw.catatan || raw.keterangan).trim() : null;

  return {
    date,
    status,
    approval_status,
    notes,
    raw_response: JSON.stringify(raw),
  };
}

/**
 * Parsing teks JSON atau CSV presensi asli
 */
export function parseAttendanceText(text: string): ParseResult {
  const trimmed = text.trim();
  const valid: ImportedAttendanceItem[] = [];
  const errors: string[] = [];

  if (!trimmed) {
    return { valid, errors: ["Konten teks kosong."] };
  }

  // Coba parse sebagai JSON
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      let list: unknown[] = [];
      if (Array.isArray(parsed)) {
        list = parsed;
      } else if (parsed && typeof parsed === "object") {
        if (Array.isArray(parsed.data)) {
          list = parsed.data;
        } else if (Array.isArray(parsed.attendances)) {
          list = parsed.attendances;
        } else if (Array.isArray(parsed.records)) {
          list = parsed.records;
        } else {
          // Kemungkinan object tunggal
          list = [parsed];
        }
      }

      let userInfo: { id?: string; name?: string; email?: string } | undefined;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const pObj = parsed as Record<string, unknown>;
        const u = (pObj.user || pObj.profile || pObj.participant) as Record<string, unknown> | undefined;
        if (u && typeof u === "object") {
          userInfo = {
            id: u.id ? String(u.id) : u.participant_id ? String(u.participant_id) : undefined,
            name: u.name ? String(u.name) : u.nama ? String(u.nama) : undefined,
            email: u.email ? String(u.email) : undefined,
          };
        }
      }

      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        if (item && typeof item === "object") {
          const itemObj = item as Record<string, unknown>;
          if (!userInfo && itemObj.participant_id) {
            userInfo = { id: String(itemObj.participant_id) };
          }
          const normalized = validateAndNormalizeItem(itemObj);
          if (normalized) {
            valid.push(normalized);
          } else {
            errors.push(`Baris JSON #${i + 1} tidak memiliki tanggal atau status valid.`);
          }
        }
      }

      return { valid, errors, userInfo };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`Format JSON tidak valid: ${msg}`);
    }
  }

  // Coba parse sebagai CSV jika bukan JSON
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length > 0) {
    const headerLine = lines[0].toLowerCase();
    const isHeader = headerLine.includes("date") || headerLine.includes("tanggal") || headerLine.includes("status");
    const dataLines = isHeader ? lines.slice(1) : lines;

    for (let i = 0; i < dataLines.length; i++) {
      const parts = dataLines[i].split(/[,;\t]/).map((p) => p.trim().replace(/^["']|["']$/g, ""));
      if (parts.length >= 2) {
        const itemObj: Record<string, unknown> = {
          date: parts[0],
          status: parts[1],
          approval_status: parts[2] || null,
          notes: parts[3] || null,
        };
        const normalized = validateAndNormalizeItem(itemObj);
        if (normalized) {
          valid.push(normalized);
        } else {
          errors.push(`Baris CSV #${i + (isHeader ? 2 : 1)}: format tanggal atau status tidak sesuai.`);
        }
      }
    }
  }

  return { valid, errors };
}

/**
 * Menyimpan data presensi yang telah diparsing ke dalam database pengguna
 */
export function processAndSaveImport(
  userId: string,
  items: ImportedAttendanceItem[],
  sourceLabel: string = "MANUAL_IMPORT_VERIFIED"
): {
  savedCount: number;
  records: DbAttendanceRecord[];
} {
  const savedRecords: DbAttendanceRecord[] = [];
  const runId = crypto.randomUUID();
  const startedAt = new Date().toISOString();

  for (const item of items) {
    const saved = attendanceRepository.upsert({
      id: `att-${userId}-${item.date}`,
      user_id: userId,
      attendance_date: item.date,
      status: item.status,
      approval_status: (item.approval_status as "APPROVED" | "PENDING" | "REJECTED" | null) || null,
      source: sourceLabel,
      source_updated_at: new Date().toISOString(),
      raw_response: item.raw_response,
      notes: item.notes || `Diimpor melalui ${sourceLabel}`,
    });
    savedRecords.push(saved);
  }

  // Audit trail
  syncRunRepository.create({
    id: runId,
    user_id: userId,
    started_at: startedAt,
    result: "SUCCESS",
    records_checked: savedRecords.length,
    message: `Impor data presensi asli berhasil (${savedRecords.length} catatan disimpan).`,
  });

  return {
    savedCount: savedRecords.length,
    records: savedRecords,
  };
}
