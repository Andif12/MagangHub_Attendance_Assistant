"use client";

import React from "react";
import { X, ExternalLink, ShieldCheck, ServerOff, Puzzle } from "lucide-react";
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
              <h2 className="text-lg font-bold text-white tracking-tight">Login ke Portal Monev Resmi</h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Alur autentikasi resmi & pembacaan presensi akun pengguna MagangHub
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
          {/* Step 1 */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="font-semibold text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-cyan-900 text-cyan-300 flex items-center justify-center text-xs font-bold">1</span>
              <span>Buka Portal Login Resmi Monev Kemnaker</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Masuk ke akun MagangHub/Monev Anda melalui browser di situs resmi Kemnaker RI. MAA tidak pernah meminta atau menyimpan kata sandi Monev Anda.
            </p>
            <button
              type="button"
              onClick={handleOpenOfficialLogin}
              className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition cursor-pointer flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
              <span>Buka monev.maganghub.kemnaker.go.id (Tab Baru)</span>
            </button>
          </div>

          {/* Technical Restriction Diagnosis */}
          <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-800/40 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-amber-300">
              <ServerOff className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Analisis Keamanan Browser (Same-Origin Policy)</span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              Sesi login portal resmi tersimpan di bawah domain <code>kemnaker.go.id</code>. Berdasarkan spesifikasi keamanan peramban W3C, website eksternal (termasuk localhost) diblokir dari membaca cookie sesi tersebut karena Kemnaker belum merilis <strong>OAuth 2.0 publik untuk pihak ketiga</strong>.
            </p>

            <div className="p-3 rounded-lg bg-slate-900 border border-slate-700 space-y-1.5 mt-2">
              <div className="flex items-center gap-1.5 font-semibold text-cyan-300 text-xs">
                <Puzzle className="w-4 h-4 text-cyan-400" />
                <span>Solusi Resmi: MAA Companion Extension</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Untuk membaca presensi nyata dari sesi aktif browser Anda tanpa menyalin token manual, pasang ekstensi di folder <code>extension/</code> pada Chrome/Edge Anda.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="font-semibold text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-cyan-900 text-cyan-300 flex items-center justify-center text-xs font-bold">2</span>
              <span>Periksa Status Presensi</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Jalankan sinkronisasi presensi untuk memverifikasi apakah kredensial atau sesi aktif telah siap membaca data kehadiran Anda.
            </p>
            <button
              type="button"
              onClick={() => {
                onSyncNow();
                onClose();
              }}
              className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-md shadow-cyan-950/40 transition cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Jalankan Sinkronisasi Sekarang</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5 text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Zero Credential Storage Policy</span>
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
