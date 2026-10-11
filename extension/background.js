// MAA Companion Background Service Worker (Manifest V3) — DOM-ONLY MODE
// Tanpa token, tanpa manipulasi cookie sesi, tanpa bypass API.

console.log("[MAA Background] Service worker aktif dalam mode DOM-Only.");

const CHECK_ALARM_NAME = "maa_dom_30min_check";

// Inisialisasi alarm periksa 30 menit
chrome.runtime.onInstalled.addListener(() => {
  console.log("[MAA Background] Menyiapkan alarm pemeriksaan DOM berkala (30 menit).");
  chrome.alarms.create(CHECK_ALARM_NAME, {
    periodInMinutes: 30,
    delayInMinutes: 1,
  });
});

/**
 * Mencari tab Monev yang sedang terbuka dan membaca DOM presensi
 */
async function performDomCheck() {
  try {
    const monevTabs = await chrome.tabs.query({
      url: "*://monev.maganghub.kemnaker.go.id/*",
    });

    if (!monevTabs || monevTabs.length === 0) {
      const state = {
        readStatus: "TAB_NOT_OPEN",
        message: "Tab portal Monev tidak sedang dibuka di browser. Pembacaan DOM memerlukan tab portal Monev aktif.",
        timestamp: new Date().toISOString(),
        attendances: [],
      };
      await chrome.storage.local.set({ latestDomData: state });
      return state;
    }

    const tabId = monevTabs[0].id;
    let resp = null;

    try {
      resp = await chrome.tabs.sendMessage(tabId, { action: "READ_DOM_ATTENDANCE" });
    } catch {
      // Jika content script belum terpasang, pasang sekarang
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content-monev.js"],
      });
      resp = await chrome.tabs.sendMessage(tabId, { action: "READ_DOM_ATTENDANCE" });
    }

    if (resp && resp.success) {
      await chrome.storage.local.set({ latestDomData: resp.data });
      // Beritahu tab MAA jika ada yang terbuka
      notifyMaaTabs(resp.data);
      return resp.data;
    } else {
      const failState = {
        readStatus: "READ_FAILED",
        message: resp?.error || "Gagal berkomunikasi dengan script halaman Monev.",
        timestamp: new Date().toISOString(),
        attendances: [],
      };
      await chrome.storage.local.set({ latestDomData: failState });
      return failState;
    }
  } catch (err) {
    const errState = {
      readStatus: "ERROR",
      message: `Terjadi kendala saat memeriksa tab Monev: ${err.message || String(err)}`,
      timestamp: new Date().toISOString(),
      attendances: [],
    };
    await chrome.storage.local.set({ latestDomData: errState });
    return errState;
  }
}

/**
 * Mencari tab yang menjalankan aplikasi web MAA (localhost, 127.0.0.1, atau vercel)
 * Aman dari Match Pattern syntax error karena memfilter properti URL di JavaScript.
 */
async function findMaaTabs() {
  try {
    const allTabs = await chrome.tabs.query({});
    return allTabs.filter((t) => {
      if (!t.url) return false;
      try {
        const u = new URL(t.url);
        return (
          u.hostname === "localhost" ||
          u.hostname === "127.0.0.1" ||
          u.hostname.includes("vercel.app") ||
          (t.title && t.title.includes("MagangHub Attendance Assistant"))
        );
      } catch {
        return false;
      }
    });
  } catch (err) {
    console.warn("[MAA Background] Gagal mencari tab MAA:", err);
    return [];
  }
}

/**
 * Meneruskan data pembacaan DOM ke tab MAA yang sedang terbuka
 */
async function notifyMaaTabs(domData) {
  try {
    const maaTabs = await findMaaTabs();
    for (const t of maaTabs) {
      if (t.id) {
        chrome.tabs.sendMessage(t.id, {
          action: "DOM_ATTENDANCE_UPDATE",
          data: domData,
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.warn("[MAA Background] Gagal meneruskan data ke tab MAA:", err);
  }
}

// Alarm Listener: Berjalan setiap 30 menit (selama browser terbuka)
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === CHECK_ALARM_NAME) {
    console.log("[MAA Background] Menjalankan pemeriksaan DOM terjadwal (Alarm 30 Menit)...");
    performDomCheck().catch((err) =>
      console.warn("[MAA Background] Gagal memeriksa DOM via alarm:", err)
    );
  }
});

// Runtime Message Listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "TRIGGER_DOM_CHECK") {
    performDomCheck().then((res) => sendResponse({ success: true, data: res }));
    return true; // async
  }

  if (request.action === "GET_LATEST_DOM_DATA") {
    chrome.storage.local.get(["latestDomData"]).then((res) => {
      sendResponse({ success: true, data: res.latestDomData || null });
    });
    return true; // async
  }

  if (request.action === "DOM_DATA_OBSERVED") {
    // Dipanggil otomatis oleh content-monev.js saat halaman Monev selesai memuat
    chrome.storage.local.set({ latestDomData: request.data });
    notifyMaaTabs(request.data);
    sendResponse({ success: true });
    return true;
  }
});
