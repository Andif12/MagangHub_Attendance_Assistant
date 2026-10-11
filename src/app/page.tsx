"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { MagangHubLoginPage } from "@/components/MagangHubLoginPage";
import { AttendanceDashboard, CompanionLiveStatus } from "@/components/AttendanceDashboard";
import { ConnectMonevModal } from "@/components/ConnectMonevModal";
import { NotificationDrawer } from "@/components/NotificationDrawer";
import { DbAttendanceRecord, DbSyncRun } from "@/lib/db/schema";
import { SafeUser, MonevConnectionState, AppNotification } from "@/types";
import { RefreshCw, LayoutDashboard, Shield } from "lucide-react";

export default function Home() {
  const [currentUser, setCurrentUser] = useState<SafeUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  const [realRecords, setRealRecords] = useState<DbAttendanceRecord[]>([]);
  const [syncRuns, setSyncRuns] = useState<DbSyncRun[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [connectionState, setConnectionState] = useState<MonevConnectionState>("BLOCKED");
  const [connectionMessage, setConnectionMessage] = useState<string>(
    "Presensi disinkronkan secara otomatis melalui MAA Companion (DOM-Only) langsung dari layar portal Monev."
  );

  // Companion Live State
  const [companionStatus, setCompanionStatus] = useState<CompanionLiveStatus>("NOT_DETECTED");
  const [companionMessage, setCompanionMessage] = useState<string | undefined>(undefined);
  const [activeView, setActiveView] = useState<"dashboard" | "gateway">("dashboard");

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
        if (recData.success && recData.records && recData.records.length > 0) {
          setRealRecords(recData.records);
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
        }
      }
    } catch (e) {
      console.warn("Gagal mengambil data pengguna:", e);
    }
  }, []);

  // 2. Periksa sesi login pengguna saat pertama kali dibuka (/api/auth/me)
  const checkCurrentUser = useCallback(async () => {
    try {
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

  // 3. Dengarkan event otomatis dari MAA Companion Extension
  useEffect(() => {
    const handleCompanionMessages = (event: MessageEvent) => {
      // A. Sinyal keberadaan companion
      if (event.data?.type === "MAA_COMPANION_ACTIVE") {
        setCompanionStatus("CONNECTED");
        setCompanionMessage("MAA Companion aktif dan siap menyinkronkan data presensi.");
      }

      // B. Penerimaan data DOM presensi aktual dari tab Monev
      if (event.data?.type === "MAA_DOM_DATA_RECEIVED" && event.data.data) {
        const domData = event.data.data;

        if (domData.readStatus === "LOADING") {
          setCompanionStatus("SYNCING");
          setCompanionMessage("Sedang membaca tampilan data presensi dari portal Monev...");
        } else if (domData.readStatus === "NOT_ON_RIWAYAT_PAGE") {
          setCompanionStatus("WAITING_PRESENSI_PAGE");
          setCompanionMessage(
            "Portal Monev terdeteksi aktif, namun belum di halaman Riwayat Kehadiran. Buka menu Riwayat Kehadiran di portal Monev."
          );
        } else if (domData.readStatus === "SUCCESS" && domData.attendances) {
          setCompanionStatus("SUCCESS");
          setCompanionMessage(
            `Sinkronisasi otomatis berhasil: ${domData.attendances.length} catatan presensi dibaca langsung dari layar Monev (${domData.paginationInfo?.periodLabel || "Periode Aktif"}).`
          );

          // Petakan item DOM menjadi format DbAttendanceRecord
          const mapped: DbAttendanceRecord[] = domData.attendances.map(
            (item: { date: string; status: string; approval_status?: string | null; notes?: string | null }) => ({
              id: `dom-${item.date}`,
              user_id: currentUser?.id || "verified-participant",
              attendance_date: item.date,
              status: item.status,
              approval_status: (item.approval_status as "APPROVED" | "PENDING" | "REJECTED" | null) || null,
              notes: item.notes || "Disinkronkan otomatis dari DOM Monev",
              source: "MONEV_COMPANION_DOM",
              source_updated_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
          );

          setRealRecords(mapped);

          // Jika ada sesi login server, otomatis teruskan ke database backend
          if (currentUser) {
            fetch("/api/auth/companion-sync", {
              method: "POST",
              headers: { "Content-Type": "application/json", ...getAuthHeaders() },
              body: JSON.stringify({
                source: "DOM_COMPANION",
                attendances: domData.attendances,
                paginationInfo: domData.paginationInfo,
              }),
            })
              .then((r) => r.json())
              .then((res) => {
                if (res.success) {
                  fetchUserData();
                }
              })
              .catch(() => {});
          }
        } else if (domData.readStatus === "TAB_NOT_OPEN") {
          setCompanionStatus("NOT_DETECTED");
          setCompanionMessage(
            "Tab portal Monev belum dibuka di peramban ini. Buka portal Monev untuk mengaktifkan sinkronisasi otomatis."
          );
        }
      }
    };

    window.addEventListener("message", handleCompanionMessages);

    // Trigger pemeriksaan companion awal
    window.postMessage({ type: "MAA_CHECK_COMPANION" }, "*");

    return () => {
      window.removeEventListener("message", handleCompanionMessages);
    };
  }, [currentUser, fetchUserData]);

  // Initial load
  useEffect(() => {
    checkCurrentUser();

    const handleFocus = () => {
      checkCurrentUser();
      window.postMessage({ type: "MAA_REQUEST_DOM_CHECK" }, "*");
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [checkCurrentUser]);

  // 4. Tombol Coba Ulang Sinkronisasi (Recovery Action)
  const handleRetryCompanionSync = () => {
    setIsSyncing(true);
    setCompanionStatus("SYNCING");
    setCompanionMessage("Menghubungi ekstensi untuk membaca ulang tampilan portal Monev...");
    window.postMessage({ type: "MAA_REQUEST_DOM_CHECK" }, "*");
    setTimeout(() => {
      setIsSyncing(false);
    }, 1500);
  };

  // 5. Logout handler
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      if (typeof window !== "undefined") {
        localStorage.removeItem("maa_token");
      }
      setCurrentUser(null);
      setRealRecords([]);
      setSyncRuns([]);
      setNotifications([]);
    } catch (err) {
      console.error("Gagal logout:", err);
    }
  };

  // 6. Tandai semua notifikasi sudah dibaca
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

  const handleOpenAuth = () => {
    window.open("https://monev.maganghub.kemnaker.go.id/login", "_blank", "noopener,noreferrer");
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
        {/* Navigation Switcher (Dashboard vs Panduan Gerbang) */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveView("dashboard")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition cursor-pointer ${
                activeView === "dashboard"
                  ? "bg-cyan-950 text-cyan-300 border border-cyan-800"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Dashboard Presensi Otomatis</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView("gateway")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition cursor-pointer ${
                activeView === "gateway"
                  ? "bg-cyan-950 text-cyan-300 border border-cyan-800"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Panduan Gerbang Monev</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-500 hidden sm:block">
            Mode Otomatisasi Nol-Input Manual Aktif
          </div>
        </div>

        {/* Loading State */}
        {isAuthLoading ? (
          <div className="py-24 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
            <span>Memeriksa koneksi sinkronisasi MAA...</span>
          </div>
        ) : activeView === "gateway" ? (
          <MagangHubLoginPage
            onRefreshSession={checkCurrentUser}
            isCheckingSession={isAuthLoading}
          />
        ) : (
          /* Dashboard Presensi Otomatis */
          <AttendanceDashboard
            records={realRecords}
            syncRuns={syncRuns}
            connectionState={connectionState}
            connectionMessage={connectionMessage}
            companionStatus={companionStatus}
            companionMessage={companionMessage}
            isSyncing={isSyncing}
            onSync={async () => handleRetryCompanionSync()}
            onRetryCompanionSync={handleRetryCompanionSync}
            onOpenConnectModal={() => setIsConnectModalOpen(true)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-900 bg-slate-950/80 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© 2026 MagangHub Attendance Assistant (MAA) • Privasi & Keamanan Nol-Token</p>
          <div className="flex items-center gap-3 text-slate-400">
            <span>Zona Waktu: WITA (Asia/Makassar)</span>
            <span>•</span>
            <button
              onClick={() => setIsConnectModalOpen(true)}
              className="hover:text-cyan-400 transition cursor-pointer"
            >
              Status Integrasi
            </button>
          </div>
        </div>
      </footer>

      {/* Modals & Drawers */}
      <ConnectMonevModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        onSyncNow={() => handleRetryCompanionSync()}
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
