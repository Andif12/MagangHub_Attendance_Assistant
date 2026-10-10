// MAA Companion Content Script - Berjalan di http://localhost:3000/* dan http://127.0.0.1:3000/*
// Mengotomatiskan login seketika tanpa perlu klik ekstensi

console.log("[MAA Companion] Content script aktif di localhost:3000.");

// Beritahu aplikasi web bahwa MAA Companion Extension aktif di browser ini
function broadcastCompanionReady() {
  window.postMessage(
    {
      type: "MAA_COMPANION_ACTIVE",
      version: "1.3.0",
      timestamp: Date.now(),
    },
    "*"
  );
}

// Jalankan broadcast segera dan ulangi setelah 500ms
broadcastCompanionReady();
setTimeout(broadcastCompanionReady, 500);

// 1. Dengarkan notifikasi jika sinkronisasi selesai di background service worker
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "SESSION_SYNCED" && request.token) {
    console.log("[MAA Companion] Sesi tersinkronisasi di latar belakang!");
    localStorage.setItem("maa_token", request.token);
    document.cookie = `maa_session=${request.token}; path=/; max-age=604800; samesite=lax`;
    window.postMessage(
      {
        type: "MAA_SESSION_READY",
        token: request.token,
        user: request.user,
      },
      "*"
    );
    // Reload halaman jika masih di halaman login
    if (!window.location.search.includes("token=")) {
      window.location.href = `http://localhost:3000/?token=${encodeURIComponent(request.token)}&sync=1`;
    }
  }
});

// 2. Fungsi auto-login ke tab Monev aktif
function triggerAutoLogin() {
  const hasLocalToken = !!localStorage.getItem("maa_token");
  const hasCookie = document.cookie.includes("maa_session=");

  if (!hasLocalToken && !hasCookie) {
    console.log("[MAA Companion] Mengirim permintaan Auto-Login ke tab Monev...");
    chrome.runtime.sendMessage({ action: "REQUEST_AUTO_LOGIN" }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn("[MAA Companion] Runtime error:", chrome.runtime.lastError.message);
        return;
      }
      if (response && response.success && response.token) {
        console.log("[MAA Companion] Auto-login berhasil dari tab Monev!");
        localStorage.setItem("maa_token", response.token);
        document.cookie = `maa_session=${response.token}; path=/; max-age=604800; samesite=lax`;
        window.location.href = `http://localhost:3000/?token=${encodeURIComponent(response.token)}&sync=1`;
      }
    });
  }
}

// Jalankan auto-login saat load
triggerAutoLogin();

// Jalankan ulang saat pengguna beralih kembali ke tab localhost (window focus)
window.addEventListener("focus", () => {
  triggerAutoLogin();
});

// Dengarkan permintaan manual dari halaman web (jika tombol 'Masuk Otomatis' diklik)
window.addEventListener("message", (event) => {
  if (event.data?.type === "MAA_REQUEST_AUTO_LOGIN") {
    console.log("[MAA Companion] Menerima sinyal permintaan login dari UI web...");
    chrome.runtime.sendMessage({ action: "REQUEST_AUTO_LOGIN" }, (response) => {
      if (response && response.success && response.token) {
        localStorage.setItem("maa_token", response.token);
        document.cookie = `maa_session=${response.token}; path=/; max-age=604800; samesite=lax`;
        window.location.href = `http://localhost:3000/?token=${encodeURIComponent(response.token)}&sync=1`;
      } else {
        window.postMessage(
          {
            type: "MAA_AUTO_LOGIN_FAILED",
            reason: response?.reason || "Gagal menghubungi tab Monev",
          },
          "*"
        );
      }
    });
  }
});
