"use client";

import React, { useState } from "react";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  X,
  FileCheck,
  RefreshCw,
  HelpCircle,
  Sparkles,
} from "lucide-react";

interface ImportAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

export const ImportAttendanceModal: React.FC<ImportAttendanceModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<"paste" | "file">("paste");
  const [rawText, setRawText] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const hasExistingSession =
    typeof window !== "undefined" && !!localStorage.getItem("maa_token");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setErrorMsg(null);
    }
  };

  const handlePasteSampleJson = () => {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Makassar",
    }).format(new Date());

    const sample = {
      data: [
        {
          date: today,
          status: "PRESENT",
          approval_status: "APPROVED",
          notes: "Catatan kehadiran resmi akun MagangHub",
        },
      ],
    };
    setRawText(JSON.stringify(sample, null, 2));
    setErrorMsg(null);
  };

  const handleExecuteImport = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      let content = "";
      if (activeTab === "file") {
        if (!selectedFile) {
          throw new Error("Silakan pilih berkas (.json atau .csv) terlebih dahulu.");
        }
        content = await selectedFile.text();
      } else {
        if (!rawText.trim()) {
          throw new Error("Silakan tempel teks data presensi JSON atau CSV.");
        }
        content = rawText;
      }

      const res = await fetch("/api/attendance/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:
            typeof window !== "undefined" && localStorage.getItem("maa_token")
              ? `Bearer ${localStorage.getItem("maa_token")}`
              : "",
        },
        body: JSON.stringify({
          content,
          email: emailInput.trim() || undefined,
          name: nameInput.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal memproses impor data.");
      }

      if (data.token && typeof window !== "undefined") {
        localStorage.setItem("maa_token", data.token);
        document.cookie = `maa_session=${data.token}; path=/; max-age=604800; samesite=lax`;
      }

      setSuccessMsg(`Berhasil mengimpor ${data.recordsSaved} catatan absensi asli!`);
      setTimeout(() => {
        onImportSuccess();
        onClose();
      }, 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-100 space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-950/80 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Impor Presensi Asli (100% Tanpa Ekstensi)
              </h3>
              <p className="text-xs text-slate-400">
                Data divalidasi langsung ke database lokal MAA Anda
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          
        </div>

        {/* Tab Selection */}
        <div className="flex p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("paste")}
            className={`flex-1 py-2 rounded-lg font-semibold transition cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === "paste"
                ? "bg-slate-800 text-cyan-400 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Tempel JSON / CSV Langsung</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("file")}
            className={`flex-1 py-2 rounded-lg font-semibold transition cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === "file"
                ? "bg-slate-800 text-cyan-400 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Unggah Berkas (.json / .csv)</span>
          </button>
        </div>

        {/* Identitas Pengguna jika belum login */}
        {!hasExistingSession && (
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="text-xs font-semibold text-slate-300">
              Identitas Akun MagangHub (Untuk Pembuatan Sesi):
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="email"
                placeholder="Email akun Anda (cth: peserta@gmail.com)"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <input
                type="text"
                placeholder="Nama Lengkap Anda"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        )}

        {/* Petunjuk Penggunaan */}
        <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-300 space-y-1.5">
          <div className="font-semibold text-cyan-300 flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Cara Mendapatkan Data Asli dari Monev:</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed pl-1">
            Buka portal resmi Monev di{" "}
            <a
              href="https://monev.maganghub.kemnaker.go.id"
              target="_blank"
              rel="noreferrer"
              className="text-cyan-400 underline hover:text-cyan-300"
            >
              monev.maganghub.kemnaker.go.id
            </a>{" "}
            &gt; Buka tab <b>Riwayat Presensi</b> &gt; Di DevTools Network, salin isi respons dari{" "}
            <code>GET /api/v1/attendances</code> lalu tempelkan di kotak di bawah.
          </p>
        </div>

        {/* Input Area */}
        {activeTab === "paste" ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">
                Isi Data Presensi (JSON / CSV):
              </label>
              <button
                type="button"
                onClick={handlePasteSampleJson}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3 h-3" />
                <span>Isi Contoh Format JSON</span>
              </button>
            </div>
            <textarea
              rows={7}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder='Tempelkan JSON respons dari Monev, contoh: {"data": [{"date": "2026-10-09", "status": "PRESENT", "approval_status": "APPROVED"}]}'
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
            />
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-300">
              Pilih Berkas Data Presensi (.json atau .csv):
            </label>
            <div className="border-2 border-dashed border-slate-700 hover:border-cyan-500/80 rounded-xl p-6 text-center transition bg-slate-950/40">
              <input
                type="file"
                accept=".json,.csv,application/json,text/csv"
                onChange={handleFileChange}
                className="hidden"
                id="file-import-input"
              />
              <label
                htmlFor="file-import-input"
                className="cursor-pointer flex flex-col items-center justify-center gap-2"
              >
                <FileCheck className="w-8 h-8 text-cyan-400" />
                <span className="text-xs text-slate-300 font-medium">
                  {selectedFile ? selectedFile.name : "Klik di sini untuk memilih berkas"}
                </span>
                <span className="text-[10px] text-slate-500">
                  Format didukung: Berkas JSON response Monev atau CSV presensi
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Alerts */}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800 text-xs text-rose-200 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold">Gagal Memproses Data</span>
              <p className="text-[11px] text-rose-300">{errorMsg}</p>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-200 flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{successMsg}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={handleExecuteImport}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-md shadow-cyan-950/40 transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSubmitting ? "animate-spin" : ""}`} />
            <span>{isSubmitting ? "Memvalidasi & Mengimpor..." : "Impor Presensi Sekarang"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
