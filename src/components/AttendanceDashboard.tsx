"use client";

import React, { useState, useMemo } from "react";
import { DbAttendanceRecord, DbSyncRun } from "@/lib/db/schema";
import {
  Calendar,
  RefreshCw,
  Clock,
  ExternalLink,
  ShieldAlert,
  Puzzle,
  CheckCircle2,
  AlertCircle,
  XCircle,
  HelpCircle,
  Coffee,
  FileEdit,
  UserCheck,
  Upload,
  CalendarDays,
  Filter,
} from "lucide-react";
import { MonevConnectionState, MonevEightStatus } from "@/types";
import {
  buildScheduledDays,
  STATUS_META,
} from "@/lib/monev/schedule-evaluator";

interface AttendanceDashboardProps {
  records: DbAttendanceRecord[];
  syncRuns: DbSyncRun[];
  connectionState: MonevConnectionState;
  connectionMessage: string;
  isSyncing: boolean;
  onSync: (startDate?: string, endDate?: string) => Promise<void>;
  onOpenConnectModal: () => void;
  onOpenImportModal?: () => void;
}

export const AttendanceDashboard: React.FC<AttendanceDashboardProps> = ({
  records,
  syncRuns,
  connectionState,
  connectionMessage,
  isSyncing,
  onSync,
  onOpenConnectModal,
  onOpenImportModal,
}) => {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Makassar",
  }).format(new Date());

  // Tentukan default start date dari catatan tertua yang ada, atau awal bulan ini
  const earliestRecordDate = useMemo(() => {
    if (records.length === 0) return today.slice(0, 7) + "-01";
    const sorted = [...records].sort((a, b) =>
      a.attendance_date.localeCompare(b.attendance_date)
    );
    return sorted[0].attendance_date;
  }, [records, today]);

  const [startDate, setStartDate] = useState(earliestRecordDate);
  const [endDate, setEndDate] = useState(today);
  const [selectedCategory, setSelectedCategory] = useState<
    MonevEightStatus | "ALL"
  >("ALL");

  // Bangun evaluasi seluruh hari dan jadwal berdasarkan 8 kategori Monev
  const { days, summary } = useMemo(() => {
    return buildScheduledDays(startDate, endDate, records, today);
  }, [startDate, endDate, records, today]);

  // Filter daftar hari berdasarkan kategori yang dipilih pengguna
  const filteredDays = useMemo(() => {
    if (selectedCategory === "ALL") return days;
    return days.filter((d) => d.category === selectedCategory);
  }, [days, selectedCategory]);

  const latestSync = syncRuns.length > 0 ? syncRuns[0] : null;

  const getCategoryIcon = (category: MonevEightStatus) => {
    switch (category) {
      case "HADIR_DISETUJUI":
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case "IZIN_DISETUJUI":
        return <UserCheck className="w-4 h-4 text-cyan-400" />;
      case "TIDAK_HADIR":
        return <XCircle className="w-4 h-4 text-rose-400" />;
      case "KEHADIRAN_DITOLAK":
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      case "PERLU_TINDAKAN":
        return <FileEdit className="w-4 h-4 text-orange-400 animate-pulse" />;
      case "MENUNGGU_MENTOR":
        return <Clock className="w-4 h-4 text-amber-400" />;
      case "BELUM_DIISI":
        return <HelpCircle className="w-4 h-4 text-slate-400" />;
      case "HARI_LIBUR":
        return <Coffee className="w-4 h-4 text-purple-400" />;
    }
  };

  const latestSource = useMemo(() => {
    if (records.length === 0) return null;
    const official = records.find((r) => r.source === "official_monev");
    if (official) return "MONEV_API_SERVER";
    return records[0].source || "MANUAL_IMPORT_VERIFIED";
  }, [records]);

  const lastUpdatedTime = useMemo(() => {
    if (latestSync?.started_at) return latestSync.started_at;
    if (records.length > 0 && records[0].last_checked_at) return records[0].last_checked_at;
    return null;
  }, [latestSync, records]);

  return (
    <div className="space-y-6">
      {/* Top Status & Sync Action Bar */}
      <div className="p-5 rounded-2xl glass-panel border border-slate-800 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="text-xs text-slate-400 font-medium">
              Status Integrasi & Otomatisasi:
            </span>
            {connectionState === "REAL_CONNECTED" ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Otomatisasi Server Aktif (Cron 30 Menit)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-950/80 text-cyan-300 border border-cyan-800/80">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                Impor Mandiri Terverifikasi (Zero Extension)
              </span>
            )}

            <button
              type="button"
              onClick={onOpenConnectModal}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 underline font-medium ml-1 transition cursor-pointer"
            >
              Info Jalur Otomatis
            </button>
          </div>

          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            {connectionMessage}
          </p>

          <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 mt-2.5">
            {lastUpdatedTime && (
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span>
                  Terakhir Diperbarui:{" "}
                  <strong className="text-slate-200">
                    {new Date(lastUpdatedTime).toLocaleString("id-ID")}
                  </strong>
                </span>
              </div>
            )}

            {latestSource && (
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                <span>
                  Sumber Data:{" "}
                  <span className="text-slate-200 font-medium">
                    {latestSource === "MONEV_API_SERVER"
                      ? "API Server Resmi Monev Kemnaker"
                      : "Impor Data Asli Monev Terverifikasi"}
                  </span>
                </span>
              </div>
            )}

            {latestSync && (
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>
                  Hasil Audit:{" "}
                  <span className="text-slate-200">
                    {latestSync.result} ({latestSync.records_checked} data)
                  </span>
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {onOpenImportModal && (
            <button
              type="button"
              onClick={onOpenImportModal}
              className="px-4 py-2.5 rounded-xl font-semibold text-xs text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-cyan-500/50 shadow-md transition cursor-pointer flex items-center gap-2"
            >
              <Upload className="w-3.5 h-3.5 text-cyan-400" />
              <span>Impor Presensi (Tanpa Ekstensi)</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onSync(startDate, endDate)}
            disabled={isSyncing}
            className="px-4 py-2.5 rounded-xl font-semibold text-xs text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-md shadow-cyan-950/40 transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? "Memeriksa..." : "Sinkronisasi Presensi Asli"}</span>
          </button>

          <a
            href="https://monev.maganghub.kemnaker.go.id"
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2.5 rounded-xl font-semibold text-xs text-cyan-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition cursor-pointer flex items-center gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Buka Portal Monev</span>
          </a>
        </div>
      </div>

      {/* Ringkasan 8 Kategori Monev (Summary Stat Cards & Filter) */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-cyan-400" />
            <span>Pemeriksaan Hari Berdasarkan Jadwal (8 Kategori Monev)</span>
          </h3>
          <span className="text-xs text-slate-400">
            Klik kartu di bawah untuk memfilter daftar hari:
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {/* 1. Hadir disetujui */}
          <button
            type="button"
            onClick={() =>
              setSelectedCategory(
                selectedCategory === "HADIR_DISETUJUI" ? "ALL" : "HADIR_DISETUJUI"
              )
            }
            className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
              selectedCategory === "HADIR_DISETUJUI"
                ? "bg-emerald-950 border-emerald-500 shadow-lg shadow-emerald-950/50 ring-2 ring-emerald-500/30"
                : "bg-slate-900/80 border-slate-800 hover:border-emerald-800/80"
            }`}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-lg font-extrabold text-emerald-400">
                {summary.hadirDisetujui}
              </span>
            </div>
            <div className="text-[11px] font-semibold text-slate-200">
              Hadir disetujui
            </div>
            <div className="text-[9px] text-slate-400 mt-0.5">Disetujui Mentor</div>
          </button>

          {/* 2. Izin disetujui */}
          <button
            type="button"
            onClick={() =>
              setSelectedCategory(
                selectedCategory === "IZIN_DISETUJUI" ? "ALL" : "IZIN_DISETUJUI"
              )
            }
            className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
              selectedCategory === "IZIN_DISETUJUI"
                ? "bg-cyan-950 border-cyan-500 shadow-lg shadow-cyan-950/50 ring-2 ring-cyan-500/30"
                : "bg-slate-900/80 border-slate-800 hover:border-cyan-800/80"
            }`}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <UserCheck className="w-4 h-4 text-cyan-400" />
              <span className="text-lg font-extrabold text-cyan-400">
                {summary.izinDisetujui}
              </span>
            </div>
            <div className="text-[11px] font-semibold text-slate-200">
              Izin disetujui
            </div>
            <div className="text-[9px] text-slate-400 mt-0.5">Izin/Sakit Sah</div>
          </button>

          {/* 3. Tidak Hadir */}
          <button
            type="button"
            onClick={() =>
              setSelectedCategory(
                selectedCategory === "TIDAK_HADIR" ? "ALL" : "TIDAK_HADIR"
              )
            }
            className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
              selectedCategory === "TIDAK_HADIR"
                ? "bg-rose-950 border-rose-500 shadow-lg shadow-rose-950/50 ring-2 ring-rose-500/30"
                : "bg-slate-900/80 border-slate-800 hover:border-rose-800/80"
            }`}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <XCircle className="w-4 h-4 text-rose-400" />
              <span className="text-lg font-extrabold text-rose-400">
                {summary.tidakHadir}
              </span>
            </div>
            <div className="text-[11px] font-semibold text-slate-200">
              Tidak Hadir
            </div>
            <div className="text-[9px] text-slate-400 mt-0.5">Alpha Tercatat</div>
          </button>

          {/* 4. Kehadiran Ditolak */}
          <button
            type="button"
            onClick={() =>
              setSelectedCategory(
                selectedCategory === "KEHADIRAN_DITOLAK"
                  ? "ALL"
                  : "KEHADIRAN_DITOLAK"
              )
            }
            className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
              selectedCategory === "KEHADIRAN_DITOLAK"
                ? "bg-red-950 border-red-500 shadow-lg shadow-red-950/50 ring-2 ring-red-500/30"
                : "bg-slate-900/80 border-slate-800 hover:border-red-800/80"
            }`}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-lg font-extrabold text-red-400">
                {summary.kehadiranDitolak}
              </span>
            </div>
            <div className="text-[11px] font-semibold text-slate-200">
              Kehadiran Ditolak
            </div>
            <div className="text-[9px] text-slate-400 mt-0.5">Ditolak Mentor</div>
          </button>

          {/* 5. Perlu Tindakan Anda */}
          <button
            type="button"
            onClick={() =>
              setSelectedCategory(
                selectedCategory === "PERLU_TINDAKAN" ? "ALL" : "PERLU_TINDAKAN"
              )
            }
            className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
              selectedCategory === "PERLU_TINDAKAN"
                ? "bg-orange-950 border-orange-500 shadow-lg shadow-orange-950/50 ring-2 ring-orange-500/30"
                : "bg-slate-900/80 border-slate-800 hover:border-orange-800/80"
            }`}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <FileEdit className="w-4 h-4 text-orange-400" />
              <span className="text-lg font-extrabold text-orange-400">
                {summary.perluTindakan}
              </span>
            </div>
            <div className="text-[11px] font-semibold text-slate-200">
              Perlu Tindakan Anda
            </div>
            <div className="text-[9px] text-slate-400 mt-0.5">Revisi / Draft</div>
          </button>

          {/* 6. Menunggu Tindakan Mentor */}
          <button
            type="button"
            onClick={() =>
              setSelectedCategory(
                selectedCategory === "MENUNGGU_MENTOR" ? "ALL" : "MENUNGGU_MENTOR"
              )
            }
            className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
              selectedCategory === "MENUNGGU_MENTOR"
                ? "bg-amber-950 border-amber-500 shadow-lg shadow-amber-950/50 ring-2 ring-amber-500/30"
                : "bg-slate-900/80 border-slate-800 hover:border-amber-800/80"
            }`}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <Clock className="w-4 h-4 text-amber-400" />
              <span className="text-lg font-extrabold text-amber-400">
                {summary.menungguMentor}
              </span>
            </div>
            <div className="text-[11px] font-semibold text-slate-200">
              Menunggu Mentor
            </div>
            <div className="text-[9px] text-slate-400 mt-0.5">Menunggu Review</div>
          </button>

          {/* 7. Belum Diisi */}
          <button
            type="button"
            onClick={() =>
              setSelectedCategory(
                selectedCategory === "BELUM_DIISI" ? "ALL" : "BELUM_DIISI"
              )
            }
            className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
              selectedCategory === "BELUM_DIISI"
                ? "bg-slate-800 border-slate-400 shadow-lg ring-2 ring-slate-400/30"
                : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <HelpCircle className="w-4 h-4 text-slate-400" />
              <span className="text-lg font-extrabold text-slate-300">
                {summary.belumDiisi}
              </span>
            </div>
            <div className="text-[11px] font-semibold text-slate-200">
              Belum Diisi
            </div>
            <div className="text-[9px] text-slate-400 mt-0.5">Hari Kerja Kosong</div>
          </button>

          {/* 8. Hari Libur */}
          <button
            type="button"
            onClick={() =>
              setSelectedCategory(
                selectedCategory === "HARI_LIBUR" ? "ALL" : "HARI_LIBUR"
              )
            }
            className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
              selectedCategory === "HARI_LIBUR"
                ? "bg-purple-950 border-purple-500 shadow-lg shadow-purple-950/50 ring-2 ring-purple-500/30"
                : "bg-slate-900/80 border-slate-800 hover:border-purple-800/80"
            }`}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <Coffee className="w-4 h-4 text-purple-400" />
              <span className="text-lg font-extrabold text-purple-400">
                {summary.hariLibur}
              </span>
            </div>
            <div className="text-[11px] font-semibold text-slate-200">
              Hari Libur
            </div>
            <div className="text-[9px] text-slate-400 mt-0.5">Akhir Pekan / Off</div>
          </button>
        </div>
      </div>

      {/* Tabel Jadwal Harian & Catatan Presensi Asli */}
      <div className="p-6 rounded-2xl glass-panel border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-cyan-400" />
              <span>Jadwal Harian &amp; Status Presensi MagangHub</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Menampilkan {filteredDays.length} dari {days.length} hari (
              {startDate} s.d. {endDate})
              {selectedCategory !== "ALL" && (
                <span className="ml-1 text-cyan-300 font-medium">
                  &bull; Filter: {STATUS_META[selectedCategory].label}
                </span>
              )}
            </p>
          </div>

          {/* Date & Filter Controls */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1">
              <span className="text-[10px] text-slate-400">Dari:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-white text-xs focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1">
              <span className="text-[10px] text-slate-400">Sampai:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-white text-xs focus:outline-none"
              />
            </div>

            {selectedCategory !== "ALL" && (
              <button
                type="button"
                onClick={() => setSelectedCategory("ALL")}
                className="px-2.5 py-1 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1 cursor-pointer"
              >
                <Filter className="w-3 h-3 text-cyan-400" />
                <span>Reset Filter</span>
              </button>
            )}
          </div>
        </div>

        {/* Tabel Rincian Hari */}
        <div className="overflow-x-auto">
          {filteredDays.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <p className="font-semibold text-slate-300">
                Tidak ada hari yang cocok dengan kriteria filter
              </p>
              <button
                type="button"
                onClick={() => setSelectedCategory("ALL")}
                className="mt-2 text-xs text-cyan-400 hover:underline cursor-pointer"
              >
                Tampilkan semua hari
              </button>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] text-slate-400 bg-slate-950/30">
                  <th className="py-2.5 px-3">Hari &amp; Tanggal</th>
                  <th className="py-2.5 px-3">Jenis Hari</th>
                  <th className="py-2.5 px-3">Status Presensi (8 Kategori)</th>
                  <th className="py-2.5 px-3">Waktu Presensi &amp; Review</th>
                  <th className="py-2.5 px-3">Catatan / Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredDays.map((item) => (
                  <tr
                    key={item.date}
                    className={`transition hover:bg-slate-900/40 ${
                      item.date === today ? "bg-cyan-950/10" : ""
                    }`}
                  >
                    {/* Kolom 1: Hari & Tanggal */}
                    <td className="py-3 px-3">
                      <div className="flex flex-col">
                        <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                          <span>{item.dayName}, {item.formattedDate}</span>
                          {item.date === today && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                              HARI INI
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">
                          {item.date}
                        </span>
                      </div>
                    </td>

                    {/* Kolom 2: Jenis Hari */}
                    <td className="py-3 px-3">
                      {item.isWorkday ? (
                        <span className="text-slate-300 font-medium text-[11px]">
                          Hari Kerja Magang
                        </span>
                      ) : (
                        <span className="text-purple-300 font-medium text-[11px]">
                          Akhir Pekan
                        </span>
                      )}
                    </td>

                    {/* Kolom 3: Status 8 Kategori Badge */}
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${item.badgeStyle.bg} ${item.badgeStyle.text} ${item.badgeStyle.border}`}
                      >
                        {getCategoryIcon(item.category)}
                        <span>{item.categoryLabel}</span>
                      </span>
                    </td>

                    {/* Kolom 4: Waktu Presensi */}
                    <td className="py-3 px-3 text-slate-300 text-[11px]">
                      {item.checkInTime ? (
                        <div className="flex flex-col gap-0.5">
                          <span>Masuk: <b className="text-slate-100">{item.checkInTime} WITA</b></span>
                          {item.reviewTime && (
                            <span className="text-[10px] text-slate-400">
                              Disetujui: {item.reviewTime} WITA
                            </span>
                          )}
                        </div>
                      ) : item.category === "HARI_LIBUR" ? (
                        <span className="text-slate-500">-</span>
                      ) : (
                        <span className="text-slate-500 italic">Belum tercatat</span>
                      )}
                    </td>

                    {/* Kolom 5: Catatan & Aksi */}
                    <td className="py-3 px-3 text-slate-300 text-[11px]">
                      {item.category === "PERLU_TINDAKAN" ? (
                        <div className="flex items-center gap-2">
                          <span className="text-orange-400 font-medium">
                            {item.notes || "Periksa laporan harian Anda di portal Monev"}
                          </span>
                          <a
                            href="https://monev.maganghub.kemnaker.go.id"
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-0.5 rounded bg-orange-950 text-orange-300 border border-orange-800 hover:bg-orange-900 transition text-[10px] font-bold"
                          >
                            Buka Monev
                          </a>
                        </div>
                      ) : item.category === "BELUM_DIISI" ? (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">
                            Presensi belum terdeteksi
                          </span>
                          {item.date === today && (
                            <a
                              href="https://monev.maganghub.kemnaker.go.id"
                              target="_blank"
                              rel="noreferrer"
                              className="px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800 hover:bg-sky-900 transition text-[10px] font-bold"
                            >
                              Isi Presensi
                            </a>
                          )}
                        </div>
                      ) : item.category === "MENUNGGU_MENTOR" ? (
                        <span className="text-amber-300/90">
                          Menunggu review mentor lapangan
                        </span>
                      ) : item.notes ? (
                        <span className="text-slate-400">{item.notes}</span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Sync Runs Audit Trail Table Card */}
      <div className="p-6 rounded-2xl glass-panel border border-slate-800 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 pb-3 border-b border-slate-800">
          <Clock className="w-4 h-4 text-cyan-400" />
          <span>Audit Trail Riwayat Pemeriksaan (Sync Runs)</span>
        </h3>

        <div className="overflow-x-auto">
          {syncRuns.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              Belum ada riwayat audit sinkronisasi yang dijalankan untuk akun Anda.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] text-slate-400">
                  <th className="py-2.5 px-3">Waktu Mulai</th>
                  <th className="py-2.5 px-3">Hasil Audit</th>
                  <th className="py-2.5 px-3">Catatan Diperiksa</th>
                  <th className="py-2.5 px-3">Keterangan Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {syncRuns.map((run) => (
                  <tr key={run.id} className="hover:bg-slate-900/40 transition">
                    <td className="py-2.5 px-3 font-mono text-slate-300 text-[11px]">
                      {new Date(run.started_at).toLocaleString("id-ID")}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          run.result === "SUCCESS"
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                            : run.result === "BLOCKED"
                            ? "bg-amber-950 text-amber-400 border border-amber-800"
                            : "bg-rose-950 text-rose-400 border border-rose-800"
                        }`}
                      >
                        {run.result}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-300">
                      {run.records_checked}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                      {run.message || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
