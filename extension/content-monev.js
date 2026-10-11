// MAA Companion Content Script — DOM-ONLY (Zero-Token Security)
// Berjalan langsung di https://monev.maganghub.kemnaker.go.id/*
// PENTING: Script ini TIDAK PERNAH memanggil API jaringan, tidak mengambil cookie,
// tidak mengekstrak Bearer token, dan tidak menyentuh kredensial apapun.

console.log("[MAA Companion] Content script aktif dalam mode DOM-Only.");

/**
 * Format tanggal Indonesia (misal: "9 Oktober 2026") menjadi format ISO "YYYY-MM-DD"
 */
function parseIndonesianDateToIso(str) {
  if (!str) return null;
  // Cek jika sudah format YYYY-MM-DD
  const isoMatch = str.match(/\b(202\d)-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/);
  if (isoMatch) return isoMatch[0];

  const monthMap = {
    jan: "01", januari: "01",
    feb: "02", februari: "02",
    mar: "03", maret: "03",
    apr: "04", april: "04",
    mei: "05",
    jun: "06", juni: "06",
    jul: "07", juli: "07",
    agu: "08", agustus: "08",
    sep: "09", september: "09",
    okt: "10", oktober: "10",
    nov: "11", november: "11",
    des: "12", desember: "12",
  };

  const idMatch = str.match(/(\d{1,2})\s+([a-zA-Z]+)\s+(202\d)/i);
  if (idMatch) {
    const day = idMatch[1].padStart(2, "0");
    const monthKey = idMatch[2].toLowerCase();
    const month = monthMap[monthKey];
    const year = idMatch[3];
    if (month) return `${year}-${month}-${day}`;
  }
  return null;
}

/**
 * Ekstraksi presensi langsung dari elemen DOM yang sudah dirender oleh Nuxt di layar
 */
function readAttendanceFromDOM() {
  const currentUrl = window.location.href;
  const isRiwayatPage = currentUrl.includes("/riwayat") || currentUrl.includes("/attendance") || document.body.innerText.includes("Riwayat Kehadiran");

  // 1. Cek apakah halaman sedang memuat (loading spinner)
  const isBusy = !!document.querySelector(".calendar-loader, .v-progress-circular, .loading-spinner, .v-overlay--active");
  if (isBusy) {
    return {
      readStatus: "LOADING",
      message: "Portal Monev sedang memuat data presensi di layar...",
      timestamp: new Date().toISOString(),
      attendances: [],
    };
  }

  // 2. Deteksi periode aktif jika tersedia (misal "Periode 1 · 1 Okt 2026 - 31 Okt 2026")
  let periodLabel = null;
  const periodSwitcher = document.querySelector(".history-period-switcher, [label*='Periode'], [class*='period']");
  if (periodSwitcher) {
    periodLabel = periodSwitcher.getAttribute("label") || periodSwitcher.innerText.trim();
  }

  const items = [];
  const seenDates = new Set();

  // 3. A: Cek apakah ada tabel HTML konvensional (table tbody tr)
  const tableRows = document.querySelectorAll("table tbody tr, .v-table tbody tr");
  if (tableRows && tableRows.length > 0) {
    tableRows.forEach((row) => {
      const rowText = row.innerText || "";
      const date = parseIndonesianDateToIso(rowText);
      if (!date || seenDates.has(date)) return;

      const cells = Array.from(row.querySelectorAll("td")).map((c) => c.innerText.trim());
      let status = "PRESENT";
      let approval = null;
      let inTime = null;
      let outTime = null;

      const fullRowLower = rowText.toLowerCase();
      if (fullRowLower.includes("tidak hadir") || fullRowLower.includes("alpha") || fullRowLower.includes("absent")) status = "ABSENT";
      else if (fullRowLower.includes("izin") || fullRowLower.includes("sakit") || fullRowLower.includes("cuti")) status = "ON_LEAVE";
      else if (fullRowLower.includes("libur") || fullRowLower.includes("dayoff")) status = "DAYOFF";
      else if (fullRowLower.includes("hadir") || fullRowLower.includes("present")) status = "PRESENT";

      if (fullRowLower.includes("disetujui") || fullRowLower.includes("approved")) approval = "APPROVED";
      else if (fullRowLower.includes("menunggu") || fullRowLower.includes("diajukan") || fullRowLower.includes("submitted")) approval = "SUBMITTED";
      else if (fullRowLower.includes("ditolak") || fullRowLower.includes("rejected")) approval = "REJECTED";

      const times = rowText.match(/\b([01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?\b/g);
      if (times && times.length >= 1) inTime = times[0];
      if (times && times.length >= 2) outTime = times[1];

      seenDates.add(date);
      items.push({
        date,
        status,
        approval_status: approval,
        in_time: inTime,
        out_time: outTime,
        notes: cells.length > 3 ? cells[cells.length - 1] : null,
      });
    });
  }

  // 4. B: Cek elemen Kalender Monev (.calendar-day-button, .calendar-table td, dll)
  const calendarDays = document.querySelectorAll(".calendar-day-button, [class*='calendar-day'], [data-date]");
  if (calendarDays && calendarDays.length > 0) {
    calendarDays.forEach((el) => {
      const rawText = el.getAttribute("aria-label") || el.getAttribute("data-date") || el.getAttribute("title") || el.innerText || "";
      const date = parseIndonesianDateToIso(rawText) || el.getAttribute("data-date");
      if (!date || seenDates.has(date)) return;

      const elLower = (rawText + " " + el.className).toLowerCase();
      let status = "PRESENT";
      let approval = null;

      if (elLower.includes("libur") || elLower.includes("holiday") || elLower.includes("dayoff")) status = "DAYOFF";
      else if (elLower.includes("tidak hadir") || elLower.includes("alpha") || elLower.includes("absent")) status = "ABSENT";
      else if (elLower.includes("izin") || elLower.includes("sakit") || elLower.includes("leave")) status = "ON_LEAVE";
      else if (elLower.includes("hadir") || elLower.includes("present")) status = "PRESENT";

      if (elLower.includes("disetujui") || elLower.includes("approved")) approval = "APPROVED";
      else if (elLower.includes("menunggu") || elLower.includes("submitted")) approval = "SUBMITTED";
      else if (elLower.includes("ditolak") || elLower.includes("rejected")) approval = "REJECTED";

      seenDates.add(date);
      items.push({
        date,
        status,
        approval_status: approval,
        in_time: null,
        out_time: null,
        notes: null,
      });
    });
  }

  // 5. C: Cek detail panel presensi harian jika sedang dibuka (.selected-report-detail, .daily-report-detail)
  const detailPanel = document.querySelector(".selected-report-detail, .daily-report-detail, [class*='report-detail']");
  if (detailPanel) {
    const detailText = detailPanel.innerText || "";
    const date = parseIndonesianDateToIso(detailText);
    if (date && !seenDates.has(date)) {
      const detailLower = detailText.toLowerCase();
      let status = "PRESENT";
      let approval = null;
      if (detailLower.includes("tidak hadir") || detailLower.includes("alpha")) status = "ABSENT";
      else if (detailLower.includes("izin") || detailLower.includes("sakit")) status = "ON_LEAVE";
      else if (detailLower.includes("hadir")) status = "PRESENT";

      if (detailLower.includes("disetujui")) approval = "APPROVED";
      else if (detailLower.includes("menunggu")) approval = "SUBMITTED";
      else if (detailLower.includes("ditolak")) approval = "REJECTED";

      seenDates.add(date);
      items.push({
        date,
        status,
        approval_status: approval,
        in_time: null,
        out_time: null,
        notes: "Dibaca dari panel detail presensi harian",
      });
    }
  }

  // 6. Baca nama peserta dari header portal Monev jika ada
  let participantName = null;
  const userHeaderEl = document.querySelector(".header-username, .user-name, [class*='user-profile'], .v-avatar ~ span");
  if (userHeaderEl) {
    const nameText = userHeaderEl.innerText.trim();
    if (nameText && nameText.length < 50 && !nameText.includes("\n")) {
      participantName = nameText;
    }
  }

  // 7. Tentukan status pembacaan akhir
  let readStatus = "SUCCESS";
  let message = `Berhasil membaca ${items.length} catatan presensi dari DOM halaman Monev.`;

  if (items.length === 0) {
    if (!isRiwayatPage) {
      readStatus = "NOT_ON_RIWAYAT_PAGE";
      message = "Tab Monev aktif, namun belum berada di halaman Riwayat Kehadiran. Buka menu Riwayat Kehadiran di portal Monev.";
    } else {
      readStatus = "EMPTY_OR_UNRECOGNIZED";
      message = "Elemen presensi tidak ditemukan di DOM. Halaman mungkin kosong atau struktur tampilan belum selesai dirender.";
    }
  }

  return {
    readStatus,
    message,
    source: "MONEV_DOM_INSPECTOR",
    timestamp: new Date().toISOString(),
    isRiwayatPage,
    paginationInfo: {
      periodLabel: periodLabel || "Tampilan Saat Ini",
      isPartial: true,
      warning: "Data ini dibaca dari tampilan aktif di layar. Jika riwayat presensi memiliki beberapa periode/bulan, buka periode lain di portal Monev untuk memperbarui.",
    },
    participantName,
    recordsCount: items.length,
    attendances: items,
  };
}

// Dengarkan permintaan dari background service worker atau popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "READ_DOM_ATTENDANCE") {
    try {
      const result = readAttendanceFromDOM();
      sendResponse({ success: true, data: result });
    } catch (err) {
      sendResponse({
        success: false,
        error: `Gagal membaca DOM Monev: ${err.message || String(err)}`,
      });
    }
    return false; // Synchronous response
  }
});

// Broadcast saat halaman dimuat atau setelah render
setTimeout(() => {
  try {
    const res = readAttendanceFromDOM();
    if (res.attendances && res.attendances.length > 0) {
      chrome.runtime.sendMessage({
        action: "DOM_DATA_OBSERVED",
        data: res,
      }).catch(() => {});
    }
  } catch {}
}, 2000);