"use client";

import React, { useState, useEffect } from "react";
import {
  Shield,
  KeyRound,
  ExternalLink,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Lock,
  RefreshCw,
  Info,
  Server,
  Layers,
} from "lucide-react";

interface ProbeResult {
  name: string;
  url: string;
  method: string;
  status: number | null;
  statusText: string | null;
  latencyMs: number;
  corsOrigin: string | null;
  wafCookie: boolean;
  contentType: string | null;
  responseSnippet: string | null;
  error?: string;
}

interface DiagnosticsData {
  success: boolean;
  timestamp: string;
  probes: ProbeResult[];
  technicalSummary: {
    ssoPortalOnline: boolean;
    authApiOnline: boolean;
    corsRestricted: boolean;
    wafProtected: boolean;
  };
}

interface MagangHubLoginPageProps {
  onRefreshSession?: () => void;
  isCheckingSession?: boolean;
}

export function MagangHubLoginPage({
  onRefreshSession,
  isCheckingSession,
}: MagangHubLoginPageProps = {}) {
  const [isInitiatingSso, setIsInitiatingSso] = useState(false);
  const [ssoError, setSsoError] = useState<string | null>(null);
  const [ssoUrl, setSsoUrl] = useState<string | null>(null);

  const [diagnostics, setDiagnostics] = useState<DiagnosticsData | null>(null);
  const [isLoadingDiagnostics, setIsLoadingDiagnostics] = useState(false);

  const [isCompanionDetected, setIsCompanionDetected] = useState(false);
  const [isAutoLoggingIn, setIsAutoLoggingIn] = useState(false);

  // Dengarkan sinyal dari MAA Companion Extension (content-localhost.js)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "MAA_COMPANION_ACTIVE") {
        setIsCompanionDetected(true);
      }
      if (event.data?.type === "MAA_SESSION_READY" && event.data?.token) {
        setIsAutoLoggingIn(true);
        if (onRefreshSession) onRefreshSession();
      }
    };

    window.addEventListener("message", handleMessage);

    // Kirim sinyal cek tab Monev secara berkala saat halaman login terbuka
    const requestAutoLogin = () => {
      window.postMessage({ type: "MAA_REQUEST_AUTO_LOGIN" }, "*");
    };

    requestAutoLogin();
    const interval = setInterval(requestAutoLogin, 3000);

    return () => {
      window.removeEventListener("message", handleMessage);
      clearInterval(interval);
    };
  }, [onRefreshSession]);

  // Jalankan live diagnostics saat halaman pertama dibuka
  const runDiagnostics = async () => {
    setIsLoadingDiagnostics(true);
    try {
      const res = await fetch("/api/auth/diagnostics");
      if (res.ok) {
        const data = await res.json();
        setDiagnostics(data);
      }
    } catch (e) {
      console.warn("Gagal menjalankan live diagnostics:", e);
    } finally {
      setIsLoadingDiagnostics(false);
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  const handleTriggerAutoLogin = () => {
    setIsAutoLoggingIn(true);
    window.postMessage({ type: "MAA_REQUEST_AUTO_LOGIN" }, "*");
    setTimeout(() => {
      if (onRefreshSession) onRefreshSession();
      setIsAutoLoggingIn(false);
    }, 1500);
  };

  // Mulai alur SSO MagangHub resmi
  const handleInitiateSso = async () => {
    setIsInitiatingSso(true);
    setSsoError(null);
    try {
      const res = await fetch("/api/auth/sso/initiate");
      const data = await res.json();

      if (res.ok && data.success && data.redirectUrl) {
        setSsoUrl(data.redirectUrl);
        // Arahkan peramban pengguna ke portal login resmi Kemnaker
        window.location.href = data.redirectUrl;
      } else {
        setSsoError(
          data.error || "Gagal mendapatkan URL otorisasi SSO dari server Monev MagangHub."
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSsoError(`Gagal menghubungi backend MAA: ${msg}`);
    } finally {
      setIsInitiatingSso(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 md:p-8">
      {/* Container Utama */}
      <div className="max-w-4xl mx-auto w-full my-auto space-y-8">
        {/* Header Branding */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-950/80 border border-sky-800/60 text-sky-400 text-xs font-semibold tracking-wide uppercase">
            <Shield className="w-3.5 h-3.5" />
            Portal Masuk Resmi MagangHub & Monev Kemnaker
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white">
            MagangHub Attendance Assistant
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto text-sm md:text-base leading-relaxed">
            Aplikasi pendamping peserta MagangHub untuk memantau status absensi asli dari Monev
            Kemnaker RI, menerima pengingat harian, dan mencatat riwayat verifikasi kehadiran.
          </p>
        </div>

        {/* Card Login Resmi MagangHub */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl backdrop-blur-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-sky-400" />
                Autentikasi Akun MagangHub
              </h2>
              <p className="text-xs text-slate-400">
                Masuk menggunakan kredensial akun MagangHub / SIAPkerja ID Anda yang sah.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-3 py-1.5 rounded-lg w-fit">
              <Lock className="w-3.5 h-3.5" />
              Zero Password Storage: Password tidak pernah disimpan di MAA
            </div>
          </div>

          {ssoError && (
            <div className="p-4 bg-red-950/60 border border-red-800/80 rounded-xl text-red-200 text-sm flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Kendala Inisiasi SSO</p>
                <p className="text-xs text-red-300 mt-1">{ssoError}</p>
              </div>
            </div>
          )}

          {/* Penjelasan Teknis callback_failed */}
          <div className="p-4 bg-amber-950/40 border border-amber-800/80 rounded-xl text-amber-200 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Mengapa Terjadi Error &quot;callback_failed&quot; di Portal Monev?</span>
            </div>
            <p className="leading-relaxed text-slate-300">
              Portal Monev menerapkan proteksi CSRF via cookie{" "}
              <code className="text-sky-300 font-mono">monev_oauth_state</code> pada domain{" "}
              <code className="text-sky-300 font-mono">*.maganghub.kemnaker.go.id</code>. Jika login
              diinisiasi dari luar domain resmi Monev (seperti dari server MAA), peramban Anda tidak
              memiliki cookie tersebut saat diarahkan ke{" "}
              <code className="text-amber-300 font-mono">/sso/callback</code>, sehingga server
              Monev menolak pertukaran kode dan memunculkan error{" "}
              <code className="text-rose-300 font-mono">reason=callback_failed</code>.
            </p>
            <div className="font-semibold text-emerald-400 pt-1">
              Solusi yang benar dan sah: Mulai proses login langsung dari portal resmi Monev, lalu
              sambungkan ke MAA via Companion Extension.
            </div>
          </div>

          {/* Opsi 1: Buka Portal Resmi Monev MagangHub */}
          <div className="space-y-3">
            <a
              href="https://monev.maganghub.kemnaker.go.id/login"
              target="_blank"
              rel="noreferrer"
              className="w-full py-4 px-6 rounded-xl font-bold text-base bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white shadow-lg shadow-sky-900/30 transition-all flex items-center justify-center gap-3 cursor-pointer text-center"
            >
              <ExternalLink className="w-5 h-5" />
              Buka &amp; Masuk di Portal Resmi Monev MagangHub (Tab Baru)
            </a>
            <p className="text-xs text-slate-400 text-center">
              Setelah berhasil masuk dan melihat Dashboard di{" "}
              <code className="text-sky-300">monev.maganghub.kemnaker.go.id</code>, gunakan MAA
              Companion Extension di peramban Anda untuk menyinkronkan data.
            </p>
          </div>

          {/* Opsi 2: Sambungkan Sesi Aktif via Extension Companion (Zero-Click Auto Login) */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">
                  Zero-Click: Masuk Otomatis via Tab Monev Aktif
                </h3>
              </div>
              <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-2.5 py-0.5 rounded-full font-mono font-semibold">
                ● Auto-Sync Active
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Jika Anda sudah membuka portal{" "}
              <a
                href="https://monev.maganghub.kemnaker.go.id"
                target="_blank"
                rel="noreferrer"
                className="text-sky-400 underline hover:text-sky-300"
              >
                monev.maganghub.kemnaker.go.id
              </a>{" "}
              di tab peramban Anda, MAA Companion Extension (v1.3.0) akan <b>langsung membaca data presensi asli Anda di latar belakang</b> tanpa perlu mengklik ikon ekstensi.
            </p>

            {/* Panduan Cara Langsung Masuk Tanpa Klik Ekstensi */}
            <div className="text-[11px] text-slate-300 bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Cara Agar Langsung Masuk Tanpa Klik Ekstensi:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-slate-300 pl-1 leading-relaxed">
                <li>
                  Buka tab portal Monev (<code>monev.maganghub.kemnaker.go.id</code>) dan pastikan akun Anda sedang login.
                </li>
                <li>
                  Di halaman <code>chrome://extensions</code>, klik ikon <b>Perbarui (Reload 🔄)</b> pada MAA Companion satu kali agar service worker v1.3.0 aktif.
                </li>
                <li>
                  Buka atau refresh halaman MAA ini (<code>localhost:3000</code>). Ekstensi langsung mendeteksi sesi Monev dan otomatis mengalihkan Anda ke <b>Attendance Dashboard</b> dalam hitungan detik!
                </li>
              </ol>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleTriggerAutoLogin}
                disabled={isAutoLoggingIn || isCheckingSession}
                className="flex-1 py-3 px-4 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-950/40 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    isAutoLoggingIn || isCheckingSession ? "animate-spin" : ""
                  }`}
                />
                {isAutoLoggingIn
                  ? "Menghubungkan ke Tab Monev..."
                  : "Masuk Otomatis dari Tab Monev Sekarang"}
              </button>

              {onRefreshSession && (
                <button
                  type="button"
                  onClick={onRefreshSession}
                  disabled={isCheckingSession}
                  className="py-3 px-4 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${isCheckingSession ? "animate-spin" : ""}`}
                  />
                  <span>Periksa Sesi</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Live Diagnostics & Bukti Teknis Endpoint */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-sky-400" />
              <h2 className="text-base font-bold text-white">
                Hasil Investigasi &amp; Bukti Teknis Endpoint Monev
              </h2>
            </div>
            <button
              onClick={runDiagnostics}
              disabled={isLoadingDiagnostics}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDiagnostics ? "animate-spin" : ""}`} />
              Uji Ulang Endpoint
            </button>
          </div>

          <p className="text-xs text-slate-400">
            Pemeriksaan langsung HTTP secara real-time dari backend MAA ke seluruh endpoint portal
            dan API Kemnaker RI:
          </p>

          {/* Tabel Status Probe Nyata */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/40">
                  <th className="py-2.5 px-3">Layanan / Endpoint</th>
                  <th className="py-2.5 px-3">Metode &amp; URL</th>
                  <th className="py-2.5 px-3">Status Respons</th>
                  <th className="py-2.5 px-3">CORS &amp; Keamanan</th>
                  <th className="py-2.5 px-3">Latensi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {diagnostics?.probes.map((probe, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 font-sans font-medium text-slate-200">
                      {probe.name}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 truncate max-w-[200px]" title={probe.url}>
                      <span className="text-sky-400 font-bold mr-1">{probe.method}</span>
                      {probe.url.replace("https://", "")}
                    </td>
                    <td className="py-2.5 px-3">
                      {probe.status ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold ${
                            probe.status === 200 || probe.status === 201
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-800/60"
                              : probe.status === 401
                              ? "bg-amber-950 text-amber-300 border border-amber-800/60"
                              : "bg-red-950 text-red-300 border border-red-800/60"
                          }`}
                        >
                          {probe.status} {probe.statusText}
                        </span>
                      ) : (
                        <span className="text-red-400 font-bold">GALAT KONEKSI</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">
                      <div className="flex flex-col gap-0.5 text-[10px]">
                        <span>CORS: {probe.corsOrigin || "Restricted (null)"}</span>
                        {probe.wafCookie && (
                          <span className="text-sky-400">Shield: Alibaba Cloud WAF / CF</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">{probe.latencyMs} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Laporan Hambatan Teknis Resmi */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2 text-xs">
            <h4 className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-sky-400" />
              Laporan Analisis Arsitektur Autentikasi (Spesifik &amp; Terverifikasi):
            </h4>
            <ul className="list-disc list-inside space-y-1 text-slate-300 leading-relaxed pl-1">
              <li>
                <b>Endpoint Initiator Tersedia:</b> Endpoint{" "}
                <code className="text-sky-300">GET /api/v1/auth/login</code> mengembalikan URL SSO
                resmi (Status 201 Created) dengan client_id{" "}
                <code className="text-slate-300">79230891-cc02-43c8-964c-b525bce27857</code>.
              </li>
              <li>
                <b>Batasan Redirect OAuth:</b> Client ID resmi Kemnaker tersebut memiliki konfigurasi{" "}
                <code className="text-amber-300">redirect_uri</code> yang terkunci secara permanen pada{" "}
                <code className="text-amber-300">
                  https://monev.maganghub.kemnaker.go.id/sso/callback
                </code>
                . Kemnaker belum menyediakan OAuth 2.0 publik untuk aplikasi pihak ketiga di luar
                portal resmi.
              </li>
              <li>
                <b>Isolasi Sesi &amp; W3C Same-Origin Policy:</b> Cookie sesi{" "}
                <code className="text-slate-300">monev_oauth_state</code> dan{" "}
                <code className="text-slate-300">kemnaker_ri_session</code> memiliki atribut{" "}
                <code className="text-sky-300">HttpOnly; Secure; SameSite=Lax</code>, sehingga tidak
                dapat dibaca oleh domain selain Kemnaker.
              </li>
              <li>
                <b>Solusi Resmi yang Berfungsi:</b> Untuk membaca data absensi nyata akun Anda tanpa
                memalsukan data atau membocorkan password, gunakan Web Companion Extension yang
                berjalan di peramban Anda dengan izin resmi terhadap host Monev.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-slate-600 mt-8">
        MagangHub Attendance Assistant (MAA) &bull; Clean Architecture &bull; Kebijakan Keamanan Kemnaker
        RI Dipatuhi Penuh
      </div>
    </div>
  );
}
