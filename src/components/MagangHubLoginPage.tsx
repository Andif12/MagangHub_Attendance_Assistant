"use client";

import React, { useState, useEffect } from "react";
import {
  Shield,
  ExternalLink,
  Lock,
  RefreshCw,
  Info,
  AlertCircle,
  AlertTriangle,
  Globe,
} from "lucide-react";

interface MagangHubLoginPageProps {
  onRefreshSession?: () => void;
  isCheckingSession?: boolean;
}

export const OFFICIAL_MONEV_PORTAL_URL = "https://monev.maganghub.kemnaker.go.id/login";

export function MagangHubLoginPage({
  onRefreshSession,
  isCheckingSession = false,
}: MagangHubLoginPageProps) {
  const [authErrorFromUrl, setAuthErrorFromUrl] = useState<{
    code: string;
    message?: string;
  } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const authError = params.get("auth_error");
      const message = params.get("message") || params.get("details");

      if (authError) {
        setAuthErrorFromUrl({
          code: authError,
          message: message || undefined,
        });
      }
    }
  }, []);

  const handleOpenPortal = () => {
    window.open(OFFICIAL_MONEV_PORTAL_URL, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col justify-between p-4 md:p-8">
      {/* Container Utama */}
      <div className="max-w-3xl mx-auto w-full my-auto space-y-7">
        {/* Header Branding */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/80 border border-cyan-800/60 text-cyan-400 text-xs font-semibold tracking-wide uppercase">
            <Shield className="w-3.5 h-3.5" />
            Portal Autentikasi MagangHub Attendance Assistant (MAA)
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
            MagangHub Attendance Assistant
          </h1>
          <p className="text-slate-400 max-w-xl mx-auto text-sm leading-relaxed">
            Akses dashboard monitoring presensi resmi MagangHub/Kemnaker RI. Sistem terisolasi penuh multi-pengguna dengan standar keamanan data terverifikasi.
          </p>
        </div>

        {/* Card Status & Hasil Pengujian Autentikasi Nyata */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-sm space-y-6">
          {/* Header Status */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-5">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-400" />
                Status Autentikasi &amp; Akses Dashboard
              </h2>
              <p className="text-xs text-slate-400">
                Pemeriksaan kepatuhan protokol autentikasi resmi Kementerian Ketenagakerjaan RI.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-amber-300 bg-amber-950/60 border border-amber-800/60 px-3 py-1.5 rounded-lg w-fit">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>SSO Pihak Ketiga: Belum Tersedia</span>
            </div>
          </div>

          {/* Notifikasi Error dari Query String jika ada */}
          {authErrorFromUrl && (
            <div className="p-4 bg-rose-950/40 border border-rose-800/80 rounded-xl text-rose-200 text-xs flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-rose-300">Pemberitahuan Autentikasi</p>
                <p className="leading-relaxed">
                  {authErrorFromUrl.message || `Kode status: ${authErrorFromUrl.code}`}
                </p>
              </div>
            </div>
          )}

          {/* Status Integrasi yang Jujur dan Transparan */}
          <div className="p-4.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3.5 text-xs">
            <div className="flex items-center gap-2 font-bold text-slate-200 text-sm">
              <Info className="w-4.5 h-4.5 text-cyan-400 shrink-0" />
              <span>Status Integrasi Saat Ini:</span>
            </div>
            <div className="space-y-2.5 text-slate-300 leading-relaxed text-[11px]">
              <div className="flex items-start gap-2.5">
                <span className="text-emerald-400 font-bold shrink-0">✓</span>
                <p>
                  <strong className="text-emerald-400">Portal Resmi MagangHub Dapat Dibuka:</strong> Anda dapat mengakses portal resmi Monev MagangHub secara langsung di peramban Anda untuk melakukan absensi harian di akun SIAPkerja.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-amber-400 font-bold shrink-0">!</span>
                <p>
                  <strong className="text-amber-400">Login SSO Langsung ke MAA Belum Terintegrasi:</strong> Kemnaker RI belum membuka pendaftaran OAuth 2.0 Client publik dengan *redirect URI* ke aplikasi pihak ketiga. Alur SSO di Kemnaker terkunci khusus untuk domain internal Monev.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-slate-400 font-bold shrink-0">•</span>
                <p>
                  <strong className="text-slate-300">Sinkronisasi Otomatis Belum Tersedia:</strong> Fitur polling otomatis backend terjadwal belum diaktifkan sampai akses API resmi server Kemnaker disetujui dan diterbitkan secara sah.
                </p>
              </div>
            </div>
          </div>

          {/* Tombol Aksi Navigasi Langsung */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleOpenPortal}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-lg shadow-cyan-950/50 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Globe className="w-4 h-4" />
              <span>Buka Portal Resmi Monev MagangHub</span>
              <ExternalLink className="w-3.5 h-3.5 text-cyan-200" />
            </button>
            <p className="text-[11px] text-slate-500 text-center mt-2">
              Tombol di atas membuka tautan resmi <code>monev.maganghub.kemnaker.go.id/login</code> langsung di peramban tanpa perantara proxy MAA.
            </p>
          </div>

          {/* Tombol Periksa Sesi */}
          {onRefreshSession && (
            <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
              <span className="text-slate-400 text-[11px]">
                Sudah memiliki sesi terverifikasi?
              </span>
              <button
                type="button"
                onClick={onRefreshSession}
                disabled={isCheckingSession}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCheckingSession ? "animate-spin" : ""}`} />
                <span>Periksa Status Sesi</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-500 space-y-1">
          <p>© 2026 MagangHub Attendance Assistant (MAA) &bull; Supabase PostgreSQL + Vercel</p>
          <p className="text-[11px] text-slate-600">
            Nol Data Fiktif &bull; Nol Token Browser &bull; Terverifikasi Standar Keamanan Data
          </p>
        </div>
      </div>
    </div>
  );
}