"use client";

import React from "react";
import { X, Bell, Check, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { AppNotification } from "@/types";

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onMarkAllAsRead: () => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllAsRead,
}) => {
  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md h-full bg-[#0c1220] border-l border-slate-800 p-6 flex flex-col shadow-2xl text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white tracking-tight">Pusat Notifikasi MAA</h2>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white">
                {unreadCount} Baru
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-900 border border-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action bar */}
        {unreadCount > 0 && (
          <div className="py-3 flex justify-end border-b border-slate-800/60">
            <button
              onClick={onMarkAllAsRead}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium transition cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Tandai Semua Dibaca</span>
            </button>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3">
          {notifications.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-xs">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>Belum ada notifikasi.</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-3.5 rounded-xl border transition ${
                  notif.is_read
                    ? "bg-slate-900/40 border-slate-800/60 text-slate-400"
                    : "bg-slate-900 border-cyan-800/60 text-slate-200 shadow-md"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {notif.type === "ATTENDANCE_MISSING" ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  ) : notif.type === "STATUS_CHANGED" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <Clock className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 text-xs">
                    <p className="leading-relaxed">{notif.message}</p>
                    <span className="text-[10px] text-slate-500 font-mono mt-1.5 block">
                      {new Date(notif.created_at).toLocaleString("id-ID")}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
