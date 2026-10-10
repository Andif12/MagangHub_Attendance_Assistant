// MAA Companion Background Service Worker (Manifest V3)
// Menangani sinkronisasi otomatis di latar belakang tanpa perlu klik ekstensi

console.log("[MAA Background] Service worker aktif.");

// Fungsi untuk menyinkronkan data Monev ke backend MAA (localhost:3000)
async function syncToLocalhost(data) {
  if (!data || !data.user || !data.user.email) return null;

  try {
    const syncRes = await fetch("http://localhost:3000/api/auth/companion-sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        user: data.user,
        attendances: data.attendances || [],
      }),
    });

    if (!syncRes.ok) return null;
    const syncJson = await syncRes.json();
    if (!syncJson.success || !syncJson.token) return null;

    // Set cookie sesi langsung di peramban untuk domain localhost:3000
    try {
      await chrome.cookies.set({
        url: "http://localhost:3000",
        name: "maa_session",
        value: syncJson.token,
        path: "/",
        sameSite: "lax",
      });
    } catch (e) {
      console.warn("[MAA Background] Gagal set cookie:", e);
    }

    return syncJson;
  } catch (err) {
    console.warn("[MAA Background] Gagal sinkronisasi ke localhost:", err);
    return null;
  }
}

// Fungsi untuk mengekstrak data dari tab Monev yang sedang terbuka
async function extractDataFromMonevTab(tabId) {
  try {
    const resp = await chrome.tabs.sendMessage(tabId, { action: "FETCH_MONEV_DATA" });
    if (resp && resp.success) return resp.data;
  } catch {
    // Jika content script belum terpasang, pasang secara dinamis
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content-monev.js"],
      });
      const resp = await chrome.tabs.sendMessage(tabId, { action: "FETCH_MONEV_DATA" });
      if (resp && resp.success) return resp.data;
    } catch (e) {
      console.warn("[MAA Background] Gagal inject content script:", e);
    }
  }
  return null;
}

// Dengarkan pesan dari content scripts (baik dari monev maupun localhost)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "AUTO_SYNC_FROM_MONEV") {
    // Dipanggil otomatis oleh content-monev.js saat portal Monev dimuat
    syncToLocalhost(request.data).then((result) => {
      sendResponse({ success: !!result, result });
      if (result && result.token) {
        // Beri tahu tab localhost jika ada yang terbuka
        chrome.tabs.query({ url: "*://localhost:3000/*" }).then((tabs) => {
          for (const t of tabs) {
            if (t.id) {
              chrome.tabs.sendMessage(t.id, {
                action: "SESSION_SYNCED",
                token: result.token,
                user: result.user,
              }).catch(() => {});
            }
          }
        });
      }
    });
    return true;
  }

  if (request.action === "REQUEST_AUTO_LOGIN") {
    // Dipanggil otomatis oleh content-localhost.js saat http://localhost:3000 dibuka
    (async () => {
      const monevTabs = await chrome.tabs.query({ url: "*://monev.maganghub.kemnaker.go.id/*" });
      if (monevTabs.length > 0 && monevTabs[0].id) {
        const data = await extractDataFromMonevTab(monevTabs[0].id);
        if (data) {
          const syncResult = await syncToLocalhost(data);
          if (syncResult && syncResult.token) {
            sendResponse({
              success: true,
              token: syncResult.token,
              user: syncResult.user,
            });
            return;
          }
        }
      }
      sendResponse({ success: false, reason: "NO_ACTIVE_MONEV_TAB" });
    })();
    return true;
  }
});
