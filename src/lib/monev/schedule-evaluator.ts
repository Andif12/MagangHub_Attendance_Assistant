import { AttendanceRecord, MonevEightStatus, ScheduledDayStatus } from "@/types";

export interface ScheduleSummary {
  hadirDisetujui: number;
  izinDisetujui: number;
  tidakHadir: number;
  kehadiranDitolak: number;
  perluTindakan: number;
  menungguMentor: number;
  belumDiisi: number;
  hariLibur: number;
  totalHari: number;
}

const INDONESIAN_DAYS = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

const INDONESIAN_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

export const STATUS_META: Record<
  MonevEightStatus,
  {
    label: string;
    description: string;
    badgeStyle: {
      bg: string;
      text: string;
      border: string;
      dot: string;
    };
  }
> = {
  HADIR_DISETUJUI: {
    label: "Hadir disetujui",
    description: "Kehadiran telah diverifikasi dan disetujui oleh Mentor Lapangan.",
    badgeStyle: {
      bg: "bg-emerald-950/80",
      text: "text-emerald-400",
      border: "border-emerald-800/80",
      dot: "bg-emerald-400",
    },
  },
  IZIN_DISETUJUI: {
    label: "Izin disetujui",
    description: "Permohonan izin atau sakit telah disetujui oleh Mentor Lapangan.",
    badgeStyle: {
      bg: "bg-cyan-950/80",
      text: "text-cyan-400",
      border: "border-cyan-800/80",
      dot: "bg-cyan-400",
    },
  },
  TIDAK_HADIR: {
    label: "Tidak Hadir",
    description: "Peserta tercatat tidak hadir (alpha) pada hari kerja magang.",
    badgeStyle: {
      bg: "bg-rose-950/80",
      text: "text-rose-400",
      border: "border-rose-800/80",
      dot: "bg-rose-400",
    },
  },
  KEHADIRAN_DITOLAK: {
    label: "Kehadiran Ditolak",
    description: "Pengajuan presensi ditolak oleh Mentor Lapangan.",
    badgeStyle: {
      bg: "bg-red-950/80",
      text: "text-red-400",
      border: "border-red-800/80",
      dot: "bg-red-400",
    },
  },
  PERLU_TINDAKAN: {
    label: "Perlu Tindakan Anda",
    description: "Terdapat catatan revisi mentor, logbook belum lengkap, atau draft absensi.",
    badgeStyle: {
      bg: "bg-orange-950/80",
      text: "text-orange-400",
      border: "border-orange-800/80",
      dot: "bg-orange-400 animate-pulse",
    },
  },
  MENUNGGU_MENTOR: {
    label: "Menunggu Tindakan Mentor",
    description: "Presensi telah dikirim peserta, sedang menunggu verifikasi mentor.",
    badgeStyle: {
      bg: "bg-amber-950/80",
      text: "text-amber-400",
      border: "border-amber-800/80",
      dot: "bg-amber-400",
    },
  },
  BELUM_DIISI: {
    label: "Belum Diisi",
    description: "Hari kerja magang tanpa catatan presensi terdeteksi.",
    badgeStyle: {
      bg: "bg-slate-900/90",
      text: "text-slate-400",
      border: "border-slate-700/80",
      dot: "bg-slate-500",
    },
  },
  HARI_LIBUR: {
    label: "Hari Libur",
    description: "Hari Sabtu, Minggu (akhir pekan) atau hari libur nasional.",
    badgeStyle: {
      bg: "bg-purple-950/40",
      text: "text-purple-300",
      border: "border-purple-800/50",
      dot: "bg-purple-400",
    },
  },
};

/**
 * Format tanggal YYYY-MM-DD ke format Indonesia (contoh: Jumat, 9 Okt 2026)
 */
export function formatIndonesianDate(dateStr: string): {
  dayName: string;
  formattedDate: string;
} {
  const [year, month, day] = dateStr.split("-").map(Number);
  const dateObj = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const dayName = INDONESIAN_DAYS[dateObj.getUTCDay()];
  const formattedDate = `${day} ${INDONESIAN_MONTHS[month - 1]} ${year}`;
  return { dayName, formattedDate };
}

/**
 * Mengevaluasi kategori presensi (1 dari 8 kategori resmi Monev) untuk sebuah hari
 * PENTING: Hari Sabtu & Minggu TIDAK otomatis dihitung sebagai Hari Libur karena jadwal libur tiap peserta berbeda.
 * Hari Libur hanya ditentukan jika:
 * 1. Tercatat dalam record presensi dengan status DAYOFF, HOLIDAY, LIBUR, atau OFF.
 * 2. Atau cocok dengan konfigurasi hari libur spesifik peserta (participantOffDays).
 */
export function evaluateDayCategory(
  dateStr: string,
  record: AttendanceRecord | undefined,
  todayStr: string,
  participantOffDays?: number[] | null
): MonevEightStatus {
  const [year, month, day] = dateStr.split("-").map(Number);
  const dateObj = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const dayOfWeek = dateObj.getUTCDay(); // 0: Minggu, 1: Senin, ..., 6: Sabtu

  // 1. Jika ada record absensi nyata
  if (record) {
    const status = String(record.status || "").toUpperCase().trim();
    const approval = record.approval_status
      ? String(record.approval_status).toUpperCase().trim()
      : null;
    const notes = String(record.notes || "").toLowerCase();

    // Ditolak
    if (approval === "REJECTED" || status === "REJECTED") {
      return "KEHADIRAN_DITOLAK";
    }

    // Perlu Tindakan Anda (Revisi diminta mentor, status REVISION, atau DRAFT)
    if (
      status === "REVISION" ||
      status === "REVISION_REQUIRED" ||
      status === "ACTION_REQUIRED" ||
      status === "DRAFT" ||
      notes.includes("revisi") ||
      notes.includes("perlu tindakan")
    ) {
      return "PERLU_TINDAKAN";
    }

    // Hari Libur tercatat dari portal (DAYOFF, HOLIDAY, LIBUR, OFF)
    if (
      status === "HOLIDAY" ||
      status === "OFF" ||
      status === "DAYOFF" ||
      status === "LIBUR" ||
      status === "WEEKEND"
    ) {
      return "HARI_LIBUR";
    }

    // Izin / Sakit
    if (
      status === "ON_LEAVE" ||
      status === "PERMISSION" ||
      status === "IZIN" ||
      status === "SICK" ||
      status === "SAKIT"
    ) {
      if (approval === "APPROVED") {
        return "IZIN_DISETUJUI";
      }
      return "MENUNGGU_MENTOR";
    }

    // Tidak Hadir (Alpha)
    if (
      status === "ABSENT" ||
      status === "ALPHA" ||
      status === "TIDAK_HADIR" ||
      status === "ALPHA_RECORDED"
    ) {
      return "TIDAK_HADIR";
    }

    // Hadir
    if (status === "PRESENT" || status === "HADIR") {
      if (approval === "APPROVED") {
        return "HADIR_DISETUJUI";
      }
      return "MENUNGGU_MENTOR";
    }

    // Default jika approval sudah disetujui
    if (approval === "APPROVED") {
      return "HADIR_DISETUJUI";
    }

    // Default lainnya saat record ada
    return "MENUNGGU_MENTOR";
  }

  // 2. Jika tidak ada record absensi:
  // JANGAN otomatis asumsikan Sabtu & Minggu sebagai Hari Libur!
  // Hanya anggap Hari Libur jika hari tersebut tercatat di konfigurasi off_days peserta.
  if (Array.isArray(participantOffDays) && participantOffDays.includes(dayOfWeek)) {
    return "HARI_LIBUR";
  }

  // Hari yang sudah lewat s.d. hari ini tanpa catatan presensi
  if (dateStr <= todayStr) {
    return "BELUM_DIISI";
  }

  // Hari di masa depan
  return "BELUM_DIISI";
}

/**
 * Ekstrak jam check-in dan review dari raw_response jika tersedia
 */
function extractTimesFromRecord(record?: AttendanceRecord): {
  checkInTime?: string;
  reviewTime?: string;
} {
  if (!record || !record.raw_response) return {};
  try {
    const raw = JSON.parse(record.raw_response);
    let checkInTime: string | undefined;
    let reviewTime: string | undefined;

    if (raw.created_at) {
      const d = new Date(raw.created_at);
      checkInTime = d.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Makassar",
      });
    }

    if (raw.reviewed_at) {
      const d = new Date(raw.reviewed_at);
      reviewTime = d.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Makassar",
      });
    }

    return { checkInTime, reviewTime };
  } catch {
    return {};
  }
}

/**
 * Menghasilkan daftar hari lengkap berdasarkan rentang jadwal beserta status 8 kategorinya
 */
export function buildScheduledDays(
  startDateStr: string,
  endDateStr: string,
  records: AttendanceRecord[],
  todayStr: string = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Makassar",
  }).format(new Date()),
  participantOffDays?: number[] | null
): {
  days: ScheduledDayStatus[];
  summary: ScheduleSummary;
} {
  const recordMap = new Map<string, AttendanceRecord>();
  for (const r of records) {
    recordMap.set(r.attendance_date, r);
  }

  const days: ScheduledDayStatus[] = [];
  const summary: ScheduleSummary = {
    hadirDisetujui: 0,
    izinDisetujui: 0,
    tidakHadir: 0,
    kehadiranDitolak: 0,
    perluTindakan: 0,
    menungguMentor: 0,
    belumDiisi: 0,
    hariLibur: 0,
    totalHari: 0,
  };

  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  // Buat iterasi hari dari start ke end
  const current = new Date(start);
  while (current <= end) {
    const dateStr = current.toISOString().slice(0, 10);
    const record = recordMap.get(dateStr);
    const category = evaluateDayCategory(dateStr, record, todayStr, participantOffDays);
    const meta = STATUS_META[category];
    const { dayName, formattedDate } = formatIndonesianDate(dateStr);
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const dayOfWeek = dt.getUTCDay();
    const isWorkday = Array.isArray(participantOffDays)
      ? !participantOffDays.includes(dayOfWeek)
      : category !== "HARI_LIBUR";

    const { checkInTime, reviewTime } = extractTimesFromRecord(record);

    const scheduledDay: ScheduledDayStatus = {
      date: dateStr,
      dayName,
      formattedDate,
      isWorkday,
      category,
      categoryLabel: meta.label,
      badgeStyle: meta.badgeStyle,
      record,
      checkInTime,
      reviewTime,
      notes: record?.notes || undefined,
      needsAction: category === "PERLU_TINDAKAN" || (category === "BELUM_DIISI" && dateStr === todayStr),
    };

    days.push(scheduledDay);

    // Update summary counts
    switch (category) {
      case "HADIR_DISETUJUI":
        summary.hadirDisetujui++;
        break;
      case "IZIN_DISETUJUI":
        summary.izinDisetujui++;
        break;
      case "TIDAK_HADIR":
        summary.tidakHadir++;
        break;
      case "KEHADIRAN_DITOLAK":
        summary.kehadiranDitolak++;
        break;
      case "PERLU_TINDAKAN":
        summary.perluTindakan++;
        break;
      case "MENUNGGU_MENTOR":
        summary.menungguMentor++;
        break;
      case "BELUM_DIISI":
        summary.belumDiisi++;
        break;
      case "HARI_LIBUR":
        summary.hariLibur++;
        break;
    }

    current.setDate(current.getDate() + 1);
  }

  summary.totalHari = days.length;

  // Urutkan terbaru di atas (descending) untuk kenyamanan pengguna memantau hari terkini
  days.reverse();

  return { days, summary };
}
