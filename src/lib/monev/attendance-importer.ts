import crypto from "crypto";
import {
  attendanceRepository,
  syncRunRepository,
  DbAttendanceRecord,
} from "../db/database";

export interface ImportedAttendanceItem {
  id?: string;
  participant_id?: string;
  date: string;
  status: string;
  approval_status?: string | null;
  in_time?: string | null;
  out_time?: string | null;
  notes?: string | null;
  raw_response?: string | null;
}

export interface PaginationInfo {
  isPaginated: boolean;
  page?: number;
  pageSize?: number;
  total?: number;
  warning?: string;
}

export interface ParseResult {
  valid: ImportedAttendanceItem[];
  errors: string[];
  userInfo?: {
    id?: string;
    name?: string;
    email?: string;
  };
  paginationInfo?: PaginationInfo;
}

export interface PreviewItem extends ImportedAttendanceItem {
  previewType: "NEW" | "UPDATE" | "DUPLICATE";
  existingStatus?: string;
  existingApprovalStatus?: string | null;
}

export interface ImportPreviewResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  newCount: number;
  updatedCount: number;
  duplicateCount: number;
  rejectedCount: number;
  items: PreviewItem[];
  errors: string[];
  userInfo?: {
    id?: string;
    name?: string;
    email?: string;
  };
  paginationInfo?: PaginationInfo;
}

export interface SaveImportResult {
  savedCount: number;
  newCount: number;
  updatedCount: number;
  duplicateCount: number;
  records: DbAttendanceRecord[];
}

/**
 * Validasi dan normalisasi satu item presensi
 */
export function validateAndNormalizeItem(raw: Record<string, unknown>): ImportedAttendanceItem | null {
  if (!raw || typeof raw !== "object") return null;

  // 1. Ekstrak dan normalisasi tanggal (ISO YYYY-MM-DD atau DD/MM/YYYY)
  const rawDate = String(raw.date || raw.attendance_date || raw.tanggal || "").trim();
  let date: string | null = null;

  const isoMatch = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    date = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  } else {
    const dmyMatch = rawDate.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, "0");
      const month = dmyMatch[2].padStart(2, "0");
      const year = dmyMatch[3];
      date = `${year}-${month}-${day}`;
    }
  }

  if (!date) return null;

  // Validasi keabsahan kalender nyata (mencegah tanggal palsu seperti 2026-02-31 atau 2026-13-40)
  const [yearStr, monthStr, dayStr] = date.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  if (isNaN(year) || isNaN(month) || isNaN(day) || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const checkDate = new Date(year, month - 1, day);
  if (
    checkDate.getFullYear() !== year ||
    checkDate.getMonth() !== month - 1 ||
    checkDate.getDate() !== day
  ) {
    return null;
  }

  // 2. Ekstrak status kehadiran (Strict mapping - tidak memalsukan status)
  const rawStatus = String(raw.status || raw.kehadiran || "").toUpperCase().trim();
  if (!rawStatus) return null;

  let status = "PRESENT";
  if (/^(PRESENT|HADIR)$/.test(rawStatus)) status = "PRESENT";
  else if (/^(ON_LEAVE|PERMISSION|IZIN|SICK|SAKIT)$/.test(rawStatus)) status = "ON_LEAVE";
  else if (/^(ABSENT|ALPHA|TIDAK_HADIR)$/.test(rawStatus)) status = "ABSENT";
  else if (/^(REJECTED|DITOLAK)$/.test(rawStatus)) status = "REJECTED";
  else if (/^(HOLIDAY|OFF|LIBUR|DAYOFF)$/.test(rawStatus)) status = "HOLIDAY";
  else status = rawStatus;

  // 3. Ekstrak status persetujuan mentor (Ketat: jika kosong, tetap null dan TIDAK dianggap approved)
  const rawApproval = String(raw.approval_status || raw.persetujuan || raw.status_persetujuan || "").toUpperCase().trim();
  let approval_status: string | null = null;
  if (/^(APPROVED|DISETUJUI)$/.test(rawApproval)) approval_status = "APPROVED";
  else if (/^(PENDING|MENUNGGU|SUBMITTED|DIAJUKAN)$/.test(rawApproval)) approval_status = "SUBMITTED";
  else if (/^(REJECTED|DITOLAK)$/.test(rawApproval)) approval_status = "REJECTED";
  else if (rawApproval) approval_status = rawApproval;

  // 4. Jam masuk dan jam keluar jika ada
  const in_time = raw.in_time || raw.check_in_time || raw.jam_masuk
    ? String(raw.in_time || raw.check_in_time || raw.jam_masuk).trim()
    : null;
  const out_time = raw.out_time || raw.check_out_time || raw.jam_pulang || raw.jam_keluar
    ? String(raw.out_time || raw.check_out_time || raw.jam_pulang || raw.jam_keluar).trim()
    : null;

  // 5. Catatan keterangan presensi
  const notes = raw.notes || raw.catatan || raw.keterangan
    ? String(raw.notes || raw.catatan || raw.keterangan).trim()
    : null;

  const id = raw.id ? String(raw.id).trim() : undefined;
  const participant_id = raw.participant_id ? String(raw.participant_id).trim() : undefined;

  return {
    id,
    participant_id,
    date,
    status,
    approval_status,
    in_time,
    out_time,
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
  let paginationInfo: PaginationInfo | undefined;

  if (!trimmed) {
    return { valid, errors: ["Konten teks data presensi kosong."] };
  }

  // Coba parse sebagai JSON jika diawali kurung kurawal atau siku
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
          list = [parsed];
        }
      }

      // Deteksi metadata pagination Monev
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const pObj = parsed as Record<string, unknown>;
        const page = typeof pObj.page === "number" ? pObj.page : undefined;
        const pageSize = typeof pObj.page_size === "number"
          ? pObj.page_size
          : typeof pObj.pageSize === "number"
          ? pObj.pageSize
          : undefined;
        const total = typeof pObj.total === "number" ? pObj.total : undefined;

        if (page !== undefined || pageSize !== undefined || list.length === 20) {
          paginationInfo = {
            isPaginated: true,
            page: page ?? 1,
            pageSize: pageSize ?? list.length,
            total,
            warning: `Data ini merupakan halaman ${page ?? 1} (berisi ${list.length} data). Jika riwayat presensi Anda di Monev terdiri atas beberapa halaman, silakan impor pula halaman lainnya agar seluruh riwayat tercakup lengkap.`,
          };
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
            errors.push(`Baris JSON #${i + 1}: format tanggal (${itemObj.date || itemObj.tanggal || "kosong"}) atau status tidak valid.`);
          }
        } else {
          errors.push(`Baris JSON #${i + 1}: format elemen bukan objek presensi yang valid.`);
        }
      }

      return { valid, errors, userInfo, paginationInfo };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`Format JSON tidak valid: ${msg}`);
      return { valid: [], errors };
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
          errors.push(`Baris CSV #${i + (isHeader ? 2 : 1)}: format tanggal '${parts[0]}' atau status tidak sesuai.`);
        }
      } else {
        errors.push(`Baris CSV #${i + (isHeader ? 2 : 1)}: jumlah kolom kurang dari 2 (wajib tanggal dan status).`);
      }
    }
  }

  return { valid, errors, paginationInfo };
}

/**
 * Menghasilkan pratinjau data presensi sebelum disimpan ke database
 */
export function generateImportPreview(
  userId: string | null | undefined,
  rawText: string
): ImportPreviewResult {
  const parseResult = parseAttendanceText(rawText);
  const items: PreviewItem[] = [];
  let newCount = 0;
  let updatedCount = 0;
  let duplicateCount = 0;

  for (const item of parseResult.valid) {
    if (userId) {
      const existing = attendanceRepository.findByUserAndDate(userId, item.date);

      if (!existing) {
        newCount++;
        items.push({
          ...item,
          previewType: "NEW",
        });
      } else {
        const isStatusSame = existing.status === item.status;
        const isApprovalSame = (existing.approval_status || null) === (item.approval_status || null);

        if (isStatusSame && isApprovalSame) {
          duplicateCount++;
          items.push({
            ...item,
            previewType: "DUPLICATE",
            existingStatus: existing.status,
            existingApprovalStatus: existing.approval_status,
          });
        } else {
          updatedCount++;
          items.push({
            ...item,
            previewType: "UPDATE",
            existingStatus: existing.status,
            existingApprovalStatus: existing.approval_status,
          });
        }
      }
    } else {
      // Pratinjau unauthenticated (sebelum login): hitung sebagai data baru
      newCount++;
      items.push({
        ...item,
        previewType: "NEW",
      });
    }
  }

  return {
    totalRows: parseResult.valid.length + parseResult.errors.length,
    validRows: parseResult.valid.length,
    invalidRows: parseResult.errors.length,
    newCount,
    updatedCount,
    duplicateCount,
    rejectedCount: parseResult.errors.length,
    items,
    errors: parseResult.errors,
    userInfo: parseResult.userInfo,
    paginationInfo: parseResult.paginationInfo,
  };
}

/**
 * Menyimpan data presensi yang telah diparsing ke dalam database pengguna
 */
export function processAndSaveImport(
  userId: string,
  items: ImportedAttendanceItem[],
  sourceLabel: string = "MANUAL_IMPORT_VERIFIED"
): SaveImportResult {
  const savedRecords: DbAttendanceRecord[] = [];
  const runId = crypto.randomUUID();
  const startedAt = new Date().toISOString();

  let newCount = 0;
  let updatedCount = 0;
  let duplicateCount = 0;

  for (const item of items) {
    const existing = attendanceRepository.findByUserAndDate(userId, item.date);

    if (!existing) {
      newCount++;
    } else {
      const isStatusSame = existing.status === item.status;
      const isApprovalSame = (existing.approval_status || null) === (item.approval_status || null);
      if (isStatusSame && isApprovalSame) {
        duplicateCount++;
      } else {
        updatedCount++;
      }
    }

    const saved = attendanceRepository.upsert({
      id: item.id ? `att-${userId}-${item.id}` : `att-${userId}-${item.date}`,
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

  // Catat audit trail sync run dengan rincian akurat
  const summaryMsg = `Impor data presensi manual berhasil: ${newCount} data baru, ${updatedCount} data diperbarui, ${duplicateCount} duplikat teridentifikasi.`;

  syncRunRepository.create({
    id: runId,
    user_id: userId,
    started_at: startedAt,
    result: "SUCCESS",
    records_checked: savedRecords.length,
    message: summaryMsg,
  });

  return {
    savedCount: savedRecords.length,
    newCount,
    updatedCount,
    duplicateCount,
    records: savedRecords,
  };
}
