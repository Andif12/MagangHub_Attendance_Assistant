// MAA Companion Content Script - Berjalan langsung di https://monev.maganghub.kemnaker.go.id/*

console.log("[MAA Companion] Content script aktif di portal Monev MagangHub.");

// 1. Ekstraksi data autentikasi & catatan presensi langsung dari konteks halaman Monev
async function extractMonevDataFromPage() {
  // A. Coba panggil /api/v1/auth/refresh dari halaman Monev (memiliki semua cookie asli)
  let bearerToken = null;
  try {
    const refreshRes = await fetch(
      "https://monev-api.maganghub.kemnaker.go.id/api/v1/auth/refresh",
      {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
      }
    );
    if (refreshRes.ok) {
      const refreshJson = await refreshRes.json();
      bearerToken =
        refreshJson?.access_token ||
        refreshJson?.data?.access_token ||
        null;
    }
  } catch (e) {
    console.warn("[MAA Companion] Gagal memanggil refresh:", e);
  }

  const authHeaders = {
    Accept: "application/json",
    ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
  };

  // B. Panggil profil pengguna /users/me
  const profRes = await fetch(
    "https://monev-api.maganghub.kemnaker.go.id/api/v1/users/me",
    {
      credentials: "include",
      headers: authHeaders,
    }
  );

  if (!profRes.ok) {
    throw new Error(
      `Gagal membaca profil Monev (HTTP ${profRes.status}). Pastikan Anda sedang login di akun Monev Anda.`
    );
  }

  const profJson = await profRes.json();
  const profile = profJson.data || profJson;

  if (!profile || (!profile.id && !profile.email)) {
    throw new Error("Data profil dari server Monev kosong.");
  }

  const participantId = profile.id || profile.participant_id;
  const email =
    profile.email || `participant_${String(participantId).slice(-4)}@maganghub.kemnaker.go.id`;
  const name = profile.name || "Peserta MagangHub";

  // C. Panggil catatan absensi 30 hari terakhir
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Makassar",
  }).format(new Date());
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 30);
  const startDate = pastDate.toISOString().slice(0, 10);

  let attUrl = `https://monev-api.maganghub.kemnaker.go.id/api/v1/attendances?start_date=${startDate}&end_date=${today}`;
  if (participantId) {
    attUrl += `&participant_id=${encodeURIComponent(participantId)}`;
  }

  let records = [];
  try {
    const attRes = await fetch(attUrl, {
      credentials: "include",
      headers: authHeaders,
    });
    if (attRes.ok) {
      const attJson = await attRes.json();
      records = attJson.data || [];
    }
  } catch (e) {
    console.warn("[MAA Companion] Gagal membaca rentang absensi:", e);
  }

  return {
    user: { id: participantId, name, email },
    attendances: records,
    token: bearerToken,
  };
}

// 2. Dengarkan pesan dari popup ekstensi
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "FETCH_MONEV_DATA") {
    extractMonevDataFromPage()
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) =>
        sendResponse({ success: false, error: err.message || String(err) })
      );
    return true; // Asynchronous response
  }
});

// 3. Auto-sync otomatis di latar belakang saat pengguna sedang di portal Monev
setTimeout(() => {
  extractMonevDataFromPage()
    .then((data) => {
      chrome.runtime.sendMessage({
        action: "AUTO_SYNC_FROM_MONEV",
        data,
      });
    })
    .catch(() => {});
}, 1500);
  