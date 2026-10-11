// MAA Companion Content Script — Berjalan di http://localhost:3000/* dan http://127.0.0.1:3000/*
// Mode DOM-Only: Tidak memanipulasi cookie sesi MAA, tidak menyuntikkan token palsu.

console.log("[MAA Companion] Content script aktif di localhost:3000 (Mode DOM-Only).");

// 1. Beritahu aplikasi web bahwa MAA Companion Extension (DOM-Only) aktif di peramban ini
function broadcastCompanionStatus() {
  window.postMessage(
    {
      type: "MAA_COMPANION_ACTIVE",
      version: "2.0.0",
      mode: "DOM_ONLY",
      timestamp: Date.now(),
    },
    "*"
  );
}

broadcastCompanionStatus();
setTimeout(broadcastCompanionStatus, 500);

// 2. Dengarkan data pembacaan DOM yang diteruskan oleh background service worker
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "DOM_ATTENDANCE_UPDATE" && request.data) {
    console.log("[MAA Companion] Menerima pembaruan data DOM presensi dari background!");
    window.postMessage(
      {
        type: "MAA_DOM_DATA_RECEIVED",
        data: request.data,
      },
      "*"
    );
  }
});

// 3. Jembatan komunikasi: Izinkan UI MAA meminta pemeriksaan DOM Monev terbaru
window.addEventListener("message", (event) => {
  if (event.data?.type === "MAA_REQUEST_DOM_CHECK") {
    console.log("[MAA Companion] Menerima permintaan cek DOM dari antarmuka web MAA...");
    chrome.runtime.sendMessage({ action: "TRIGGER_DOM_CHECK" }, (response) => {
      if (chrome.runtime.lastError) {
        window.postMessage(
          {
            type: "MAA_DOM_CHECK_RESULT",
            success: false,
            error: chrome.runtime.lastError.message,
          },
          "*"
        );
        return;
      }
      window.postMessage(
        {
          type: "MAA_DOM_CHECK_RESULT",
          success: true,
          data: response?.data || null,
        },
        "*"
      );
    });
  }
});
