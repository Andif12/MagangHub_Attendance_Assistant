"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { MagangHubLoginPage } from "@/components/MagangHubLoginPage";
import { AttendanceDashboard } from "@/components/AttendanceDashboard";
import { ConnectMonevModal } from "@/components/ConnectMonevModal";
import { NotificationDrawer } from "@/components/NotificationDrawer";
import { DbAttendanceRecord, DbSyncRun } from "@/lib/db/schema";
import { SafeUser, MonevConnectionState, AppNotification } from "@/types";
import { RefreshCw } from "lucide-react";

export default function Home() {
  const [currentUser, setCurrentUser] = useState<SafeUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  const [realRecords, setRealRecords] = useState<DbAttendanceRecord[]>([]);
  const [syncRuns, setSyncRuns] = useState<DbSyncRun[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [connectionState, setConnectionState] = useState<MonevConnectionState>("BLOCKED");
  const [connectionMessage, setConnectionMessage] = useState<string>(
    "Integrasi Monev MagangHub berstatus BLOCKED/UNVERIFIED: Sesi browser di portal Kemnaker diisolasi oleh peramban (W3C Same-Origin Policy) dan Kemnaker belum merilis OAuth 2.0 publik untuk aplikasi pihak ketiga."
  );

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState<boolean>(false);

  const getAuthHeaders = (): Record<string, string> => {
    if (typeof window === "undefined") return {};
    const token = localStorage.getItem("maa_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // 1. Ambil data catatan presensi & audit sync milik pengguna yang sedang login
  const fetchUserData = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      const [recRes, runsRes, notifRes, statusRes] = await Promise.all([
        fetch("/api/attendance/records", { headers }),
        fetch("/api/attendance/sync-runs", { headers }),
        fetch("/api/notifications", { headers }),
        fetch("/api/attendance/status", { headers }),
      ]);

      if (recRes.ok) {
        const recData = await recRes.json();
        if (recData.success) {
          setRealRecords(recData.records || []);
        }
      }

      if (runsRes.ok) {
        const runsData = await runsRes.json();
        if (runsData.success) {
          setSyncRuns(runsData.syncRuns || []);
        }
      }

      if (notifRes.ok) {
        const notifData = await notifRes.json();
        if (notifData.success) {
          setNotifications(notifData.notifications || []);
        }
      }

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        if (statusData.success && statusData.data) {
          setConnectionState(statusData.data.state);
          setConnectionMessage(statusData.data.summary);
        }
      }
    } catch (e) {
      console.warn("Gagal mengambil data pengguna:", e);
    }
  }, []);

  // 2. Periksa sesi login pengguna saat pertama kali dibuka (/api/auth/me)
  const checkCurrentUser = useCallback(async () => {
    try {
      // Periksa token jembatan dari URL parameter (?token=...)
      if (typeof window !== "undefined") {
        const urlParams = new URLSearchParams(window.location.search);
        const tokenFromUrl = urlParams.get("token");
        if (tokenFromUrl) {
          document.cookie = `maa_session=${tokenFromUrl}; path=/; max-age=604800; samesite=lax`;
          localStorage.setItem("maa_token", tokenFromUrl);
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }

      const headers = getAuthHeaders();
      const res = await fetch("/api/auth/me", { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          setCurrentUser(data.user);
          await fetchUserData();
        } else {
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
    } catch {
      setCurrentUser(null);
    } finally {
      setIsAuthLoading(false);
    }
  }, [fetchUserData]);

  // Initial load & Auto-detect saat pengguna kembali ke tab ini dari ekstensi
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkCurrentUser();

    const handleFocus = () => {
      checkCurrentUser();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        checkCurrentUser();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [checkCurrentUser]);

  // 3. Jalankan sinkronisasi presensi asli ke server Monev
  const handleSyncAttendance = async (startDate?: string, endDate?: string) => {
    if (!currentUser) {
      handleOpenAuth();
      return;
    }

    setIsSyncing(true);
    try {
      const res = await fetch("/api/attendance/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate }),
      });
      const data = await res.json();

      if (data.connectionState) {
        setConnectionState(data.connectionState);
      }
      if (data.message) {
        setConnectionMessage(data.message);
      }

      await fetchUserData();
    } catch (err) {
      console.error("Gagal sinkronisasi:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  // 4. Logout handler
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setCurrentUser(null);
      setRealRecords([]);
      setSyncRuns([]);
      setNotifications([]);
    } catch (err) {
      console.error("Gagal logout:", err);
    }
  };

  // 5. Tandai semua notifikasi sudah dibaca
  const handleMarkAllNotificationsAsRead = async () => {
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
    } catch (err) {
      console.error("Gagal memperbarui notifikasi:", err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleOpenAuth = async () => {
    try {
      const res = await fetch("/api/auth/sso/initiate");
      const data = await res.json();
      if (res.ok && data.success && data.redirectUrl) {
        window.location.href = data.redirectUrl;
      }
    } catch {}
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#090d16] text-slate-100 selection:bg-cyan-500 selection:text-black">
      {/* Top Header */}
      <Header
        user={currentUser}
        connectionState={connectionState}
        unreadCount={unreadCount}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenConnectModal={() => setIsConnectModalOpen(true)}
        onLogout={handleLogout}
        onOpenAuth={handleOpenAuth}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Loading State */}
        {isAuthLoading ? (
          <div className="py-24 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
            <span>Memeriksa sesi pengguna MAA...</span>
          </div>
        ) : !currentUser ? (
          /* Halaman Pertama: Login Langsung dengan Akun MagangHub / Kemnaker SSO */
          <MagangHubLoginPage
            onRefreshSession={checkCurrentUser}
            isCheckingSession={isAuthLoading}
          />
        ) : (
          /* When Logged In: Real Attendance Dashboard */
          <AttendanceDashboard
            records={realRecords}
            syncRuns={syncRuns}
            connectionState={connectionState}
            connectionMessage={connectionMessage}
            isSyncing={isSyncing}
            onSync={handleSyncAttendance}
            onOpenConnectModal={() => setIsConnectModalOpen(true)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-900 bg-slate-950/80 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© 2026 MagangHub Attendance Assistant (MAA) • Privasi & Keamanan Terverifikasi</p>
          <div className="flex items-center gap-3 text-slate-400">
            <span>Zona Waktu: WITA (Asia/Makassar)</span>
            <span>•</span>
            <button
              onClick={() => setIsConnectModalOpen(true)}
              className="hover:text-cyan-400 transition cursor-pointer"
            >
              Status Portal Monev
            </button>
          </div>
        </div>
      </footer>

      {/* Modals & Drawers */}
      <ConnectMonevModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        onSyncNow={() => handleSyncAttendance()}
      />

      <NotificationDrawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onMarkAllAsRead={handleMarkAllNotificationsAsRead}
      />
    </div>
  );
}
