"use client";

import React from "react";
import { ShieldCheck, Bell, LogOut, CheckCircle2, AlertTriangle, ShieldAlert } from "lucide-react";
import { MonevConnectionState, SafeUser } from "@/types";

interface HeaderProps {
  user: SafeUser | null;
  connectionState: MonevConnectionState;
  unreadCount: number;
  onOpenNotifications: () => void;
  onOpenConnectModal: () => void;
  onLogout: () => void;
  onOpenAuth: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  connectionState,
  unreadCount,
  onOpenNotifications,
  onOpenConnectModal,
  onLogout,
  onOpenAuth,
}) => {
  const renderConnectionBadge = () => {
    switch (connectionState) {
      case "REAL_CONNECTED":
        return (
          <button
            type="button"
            onClick={onOpenConnectModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800 transition cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Monev Terhubung</span>
          </button>
        );
      case "BLOCKED":
        return (
          <button
            type="button"
            onClick={onOpenConnectModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-950 text-amber-300 border border-amber-800 transition cursor-pointer"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span>Integrasi Dibatasi (SOP Browser)</span>
          </button>
        );
      case "UNVERIFIED":
      default:
        return (
          <button
            type="button"
            onClick={onOpenConnectModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-slate-400 border border-slate-700 transition cursor-pointer"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-slate-500" />
            <span>Belum Terhubung</span>
          </button>
        );
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-slate-800/80 px-4 lg:px-8 py-3.5 backdrop-blur-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-950/50 border border-cyan-400/30">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-white tracking-tight">MagangHub</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/60">
                MAA Official
              </span>
            </div>
            <p className="text-xs text-slate-400">Attendance Assistant & Inspeksi Monev</p>
          </div>
        </div>

        {/* Center Monev Status Badge */}
        <div className="hidden md:flex items-center gap-3">
          {renderConnectionBadge()}
        </div>

        {/* User Profile / Notifications / Logout */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenNotifications}
            title="Notifikasi"
            className="relative p-2 rounded-lg text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700 transition cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {user ? (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <div className="hidden sm:block text-right">
                <span className="text-xs font-semibold text-white block">{user.name}</span>
                <span className="text-[10px] text-slate-400 block">{user.email}</span>
              </div>
              <button
                type="button"
                onClick={onLogout}
                title="Keluar dari MAA"
                className="p-2 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-semibold text-rose-300 hover:text-white bg-rose-950/40 hover:bg-rose-900/40 border border-rose-800 transition cursor-pointer flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Keluar</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 shadow-md shadow-sky-950/40 transition cursor-pointer"
            >
              Masuk dengan Akun MagangHub
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
