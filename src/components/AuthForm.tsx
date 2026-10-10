"use client";

import React, { useState } from "react";
import { Lock, Mail, User, Shield, AlertCircle, ArrowRight, Eye, EyeOff } from "lucide-react";
import { SafeUser } from "@/types";

interface AuthFormProps {
  onSuccess: (user: SafeUser) => void;
}

export const AuthForm: React.FC<AuthFormProps> = ({ onSuccess }) => {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      const endpoint = tab === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload = tab === "login" ? { email, password } : { name, email, password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "Gagal memproses permintaan.");
        return;
      }

      if (data.success && data.user) {
        onSuccess(data.user);
      }
    } catch {
      setErrorMsg("Terjadi gangguan koneksi ke server. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 sm:p-8 rounded-2xl glass-panel border border-slate-700/80 shadow-2xl text-slate-200">
      <div className="flex items-center justify-center gap-2 mb-2">
        <Shield className="w-6 h-6 text-cyan-400" />
        <h2 className="text-xl font-bold tracking-tight text-white">MagangHub Attendance Assistant</h2>
      </div>
      <p className="text-xs text-center text-slate-400 mb-6">
        Masuk atau daftarkan akun MAA pribadi Anda untuk mengakses data presensi nyata
      </p>

      {/* Tab Selector */}
      <div className="grid grid-cols-2 gap-1 p-1 bg-slate-900/80 rounded-xl mb-6 border border-slate-800">
        <button
          type="button"
          onClick={() => {
            setTab("login");
            setErrorMsg(null);
          }}
          className={`py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
            tab === "login"
              ? "bg-cyan-600 text-white shadow-md shadow-cyan-950/50"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Masuk
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("register");
            setErrorMsg(null);
          }}
          className={`py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
            tab === "register"
              ? "bg-cyan-600 text-white shadow-md shadow-cyan-950/50"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Daftar Akun Baru
        </button>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 rounded-xl bg-rose-950/30 border border-rose-800/60 text-xs text-rose-300 flex items-start gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
          <p>{errorMsg}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {tab === "register" && (
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Nama Lengkap</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama Anda"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">Email</label>
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              className="w-full pl-9 pr-3 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">Kata Sandi</label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={tab === "register" ? "Min. 8 karakter (huruf besar, kecil, angka)" : "Kata sandi Anda"}
              className="w-full pl-9 pr-10 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 transition cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {tab === "register" && (
            <p className="text-[10px] text-slate-400 mt-1">
              Kata sandi di-hash dengan aman menggunakan bcrypt (salt rounds = 12).
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full mt-2 py-2.5 px-4 rounded-xl font-semibold text-xs text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-md shadow-cyan-950/40 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <span>{isLoading ? "Memproses..." : tab === "login" ? "Masuk ke MAA" : "Daftar Akun MAA"}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </form>

      <div className="mt-6 pt-4 border-t border-slate-800 text-center text-[11px] text-slate-500">
        Keamanan MAA: Zero credential storage, isolasi data per akun, dan sesi HttpOnly terenkripsi.
      </div>
    </div>
  );
};
