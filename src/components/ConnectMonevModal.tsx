"use client";

import React from "react";
import { X, ExternalLink, ShieldCheck, Server, FileText, CheckCircle2 } from "lucide-react";
import { OFFICIAL_MONEV_LOGIN_URL } from "@/lib/monev/auth-investigation";

interface ConnectMonevModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncNow: () => void;
}

export const ConnectMonevModal: React.FC<ConnectMonevModalProps> = ({
  isOpen,
  onClose,
  onSyncNow,
}) => {
  if (!isOpen) return null;

  const handleOpenOfficialLogin = () => {
    window.open(OFFICIAL_MONEV_LOGIN_URL, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl glass-panel border border-slate-700 shadow-2xl p-6 sm:p-7 text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
              <h2 className="text-lg font-bold text-white tracking-tight">
                Integrasi & Otomatisasi Presensi Monev
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Arsitektur sinkronisasi mandiri tanpa browser extension
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-5 space-y-4 text-xs">
          {/* Jalur 1: Otomatisasi Backend Server (Cron 30 Menit) */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
            <div className="font-semibold text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-400" />
              <span>1. Sinkronisasi Otomatis Backend (Cron 30 Menit)</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              MAA telah dilengkapi service background scheduler dan endpoint cron deployment (<code>/api/cron/sync</code>) dengan interval 30 menit. Jalur ini aktif ketika environment server backend dikonfigurasi dengan kredensial resmi (<code>MONEV_AUTH_TOKEN</code> dan <code>MONEV_PARTICIPANT_ID</code>).
            </p>
            <div className="text-[11px] text-slate-400 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80">
              <strong className="text-slate-200">Kondisi Saat Ini:</strong> Jika kredensial server belum disetel, scheduler mencatat audit secara transparan tanpa memalsukan data presensi.
            </div>
          </div>

          {/* Jalur 2: Impor Mandiri Terverifikasi (Zero Extension) */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
            <div className="font-semibold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              <span>2. Impor Data Asli Monev Terverifikasi (Aktif & Berjalan)</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Peserta dapat mengimpor respons data presensi asli dari portal Monev secara langsung tanpa perlu memasang browser extension, tanpa perlu menyalin kata sandi, dan dengan isolasi data penuh di database lokal.
            </p>
          </div>

          {/* Jalur Resmi Kemnaker Kedepannya */}
          <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-800/40 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-cyan-300">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Jalur Resmi Pengaktifan Otomatisasi Penuh</span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              Agar aplikasi yang di-deploy dapat membaca data secara otomatis tanpa interaksi berkas sama sekali, Kemnaker perlu menyediakan:
            </p>
            <ul className="list-disc list-inside text-[11px] text-slate-400 space-y-1">
              <li>Pendaftaran OAuth 2.0 Partner / API Client resmi Kemnaker RI.</li>
              <li>Atau Personal Access Token (PAT) resmi di profil peserta MagangHub.</li>
            </ul>
          </div>

          {/* Tombol Aksi */}
          <div className="pt-2 flex flex-col gap-2">
            <button
              type="button"
              onClick={handleOpenOfficialLogin}
              className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition cursor-pointer flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
              <span>Buka Portal monev.maganghub.kemnaker.go.id (Tab Baru)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onSyncNow();
                onClose();
              }}
              className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-md shadow-cyan-950/40 transition cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Uji Audit / Sinkronisasi Presensi Sekarang</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5 text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Keamanan Terjamin & Tanpa Penyimpanan Kredensial Sensitif</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-slate-900 border border-slate-800 transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
