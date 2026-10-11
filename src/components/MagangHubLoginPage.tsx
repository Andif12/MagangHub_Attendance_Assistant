"use client";

import React, { useState, useEffect } from "react";
import {
  Shield,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ArrowRight,
  Radio,
  Layers,
  RefreshCw,
} from "lucide-react";

interface MagangHubLoginPageProps {
  onRefreshSession?: () => void;
  isCheckingSession?: boolean;
}

export const OFFICIAL_MONEV_PORTAL_URL = "https://monev.maganghub.kemnaker.go.id/login";
export const OFFICIAL_RIWAYAT_URL = "https://monev.maganghub.kemnaker.go.id/dashboard/riwayat";

export function MagangHubLoginPage({
  onRefreshSession,
  isCheckingSession = false,
}: MagangHubLoginPageProps) {
  const [companionDetected, setCompanionDetected] = useState(false);
  const [companionVersion, setCompanionVersion] = useState<string | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "MAA_COMPANION_ACTIVE") {
        setCompanionDetected(true);
        setCompanionVersion(event.data?.version || "2.0.0");
      }
    };

    window.addEventListener("message", handleMessage);

    // Kirim sinyal cek ekstensi
    window.postMessage({ type: "MAA_CHECK_COMPANION" }, "*");

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  const handleOpenPortal = () => {
    window.open(OFFICIAL_MONEV_PORTAL_URL, "_blank", "noopener,noreferrer");
  };

  const handleOpenRiwayat = () => {
    window.open(OFFICIAL_RIWAYAT_URL, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-[75vh] flex flex-col justify-center items-center py-6 px-4">
      <div className="max-w-2xl w-full space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/80 border border-cyan-800/60 text-cyan-400 text-xs font-semibold tracking-wide uppercase">
            <Shield className="w-3.5 h-3.5" />
            <span>MagangHub Attendance Assistant (MAA) &bull; Mode Otomatis</span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white">
            Sinkronisasi Presensi Otomatis
          </h1>

          <p className="text-slate-400 max-w-lg mx-auto text-xs sm:text-sm leading-relaxed">
            Asisten monitoring presensi otomatis yang terhubung langsung dengan tampilan resmi portal Monev MagangHub Kemnaker RI tanpa input manual.
          </p>
        </div>

        {/* Status Deteksi Ekstensi Companion */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${companionDetected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
            <div>
              <div className="text-xs font-semibold text-white">
                {companionDetected
                  ? `MAA Companion Aktif (v${companionVersion})`
                  : "Menunggu Ekstensi Browser Companion"}
              </div>
              <div className="text-[11px] text-slate-400">
                {companionDetected
                  ? "Ekstensi siap membaca tampilan presensi Monev secara otomatis."
                  : "Pasang ekstensi MAA (DOM-Only) di peramban Anda untuk otomatisasi penuh."}
              </div>
            </div>
          </div>

          {onRefreshSession && (
            <button
              type="button"
              onClick={onRefreshSession}
              disabled={isCheckingSession}
              className="px-3 py-1.5 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isCheckingSession ? "animate-spin" : ""}`} />
              <span>Periksa Sesi</span>
            </button>
          )}
        </div>

        {/* 3 Langkah Alur Otomatis */}
        <div className="p-6 rounded-2xl glass-panel border border-slate-800 shadow-xl space-y-4">
          <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400" />
            <span>Alur Otomatisasi (Zero-Manual Workflow)</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
              <div className="w-6 h-6 rounded-lg bg-cyan-950 text-cyan-400 font-bold text-xs flex items-center justify-center border border-cyan-800">
                1
              </div>
              <div className="text-xs font-semibold text-white">Masuk di Portal Resmi</div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Buka portal resmi Monev dan masuk menggunakan akun SIAPkerja Anda.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
              <div className="w-6 h-6 rounded-lg bg-cyan-950 text-cyan-400 font-bold text-xs flex items-center justify-center border border-cyan-800">
                2
              </div>
              <div className="text-xs font-semibold text-white">Buka Riwayat Kehadiran</div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Buka menu Riwayat Kehadiran di portal Monev pada peramban Anda.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
              <div className="w-6 h-6 rounded-lg bg-cyan-950 text-cyan-400 font-bold text-xs flex items-center justify-center border border-cyan-800">
                3
              </div>
              <div className="text-xs font-semibold text-white">Otomatis Masuk MAA</div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Companion membaca data layar secara aman dan dashboard MAA langsung terisi.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              onClick={handleOpenPortal}
              className="w-full sm:flex-1 py-3 px-4 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-lg shadow-cyan-950/50 transition cursor-pointer flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Buka Portal Resmi Monev Kemnaker</span>
            </button>

            <button
              type="button"
              onClick={handleOpenRiwayat}
              className="w-full sm:flex-1 py-3 px-4 rounded-xl font-bold text-xs text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Buka Halaman Riwayat Presensi</span>
              <ArrowRight className="w-4 h-4 text-cyan-400" />
            </button>
          </div>
        </div>

        {/* Jaminan Keamanan Privasi */}
        <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-900 text-[11px] text-slate-400 space-y-1 leading-relaxed">
          <div className="font-semibold text-slate-300 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Jaminan Keamanan & Privasi Mutlak</span>
          </div>
          <p>
            MAA <b>tidak pernah</b> meminta kata sandi SIAPkerja, tidak mengekstrak token otentikasi, dan tidak membaca cookie peramban Anda. Seluruh proses sinkronisasi berjalan secara pasif pada tampilan resmi yang sudah Anda buka secara sah.
          </p>
        </div>
      </div>
    </div>
  );
}