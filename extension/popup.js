// MAA Companion Popup Script — DOM-ONLY (Zero-Token Security & Direct Execution)

document.addEventListener("DOMContentLoaded", async () => {
  const tabStatusEl = document.getElementById("tabStatus");
  const readStatusTextEl = document.getElementById("readStatusText");
  const recordsContainerEl = document.getElementById("recordsContainer");
  const recordsCountEl = document.getElementById("recordsCount");
  const recordsListEl = document.getElementById("recordsList");
  const readDomBtn = document.getElementById("readDomBtn");
  const openMonevBtn = document.getElementById("openMonevBtn");
  const forwardToMaaBtn = document.getElementById("forwardToMaaBtn");
  const actionMsgEl = document.getElementById("actionMsg");

  let currentDomData = null;

  // 1. Fungsi ekstraksi DOM yang dieksekusi langsung di konteks tab Monev
  function extractAttendanceFromDOMDirectly() {
    try {
      const currentUrl = window.location.href;
      const isLogin = currentUrl.includes("/login") || currentUrl.includes("account.kemnaker.go.id");
      if (isLogin) {
        return {
          readStatus: "NOT_LOGGED_IN",
          message: "Portal Monev masih berada di halaman Login. Silakan masuk terlebih dahulu dengan akun SIAPkerja Anda.",
          timestamp: new Date().toISOString(),
          attendances: [],
        };
      }

      const bodyText = document.body ? document.body.innerText : "";
      const isRiwayatPage = currentUrl.includes("/riwayat") || currentUrl.includes("/attendance") || bodyText.includes("Riwayat Kehadiran") || bodyText.includes("Riwayat Presensi");

      // Cek loading spinner
      const isBusy = !!document.querySelector(".calendar-loader, .v-progress-circular, .loading-spinner, .v-overlay--active");
      if (isBusy) {
        return {
          readStatus: "LOADING",
          message: "Portal Monev sedang memuat data presensi di layar...",
          timestamp: new Date().toISOString(),
          attendances: [],
        };
      }

      function parseIndonesianDateToIso(str) {
        if (!str) return null;
        const isoMatch = str.match(/\b(202\d)-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/);
        if (isoMatch) return isoMatch[0];

        const monthMap = {
          jan: "01", januari: "01", feb: "02", februari: "02", mar: "03", maret: "03",
          apr: "04", april: "04", mei: "05", jun: "06", juni: "06", jul: "07", juli: "07",
          agu: "08", agustus: "08", sep: "09", september: "09", okt: "10", oktober: "10",
          nov: "11", november: "11", des: "12", desember: "12"
        };
        const idMatch = str.match(/(\d{1,2})\s+([a-zA-Z]+)\s+(202\d)/i);
        if (idMatch) {
          const day = idMatch[1].padStart(2, "0");
          const month = monthMap[idMatch[2].toLowerCase()];
          const year = idMatch[3];
          if (month) return `${year}-${month}-${day}`;
        }
        return null;
      }

      // Deteksi label periode aktif
      let periodLabel = null;
      const periodSwitcher = document.querySelector(".history-period-switcher, [label*='Periode'], [class*='period']");
      if (periodSwitcher) {
        periodLabel = periodSwitcher.getAttribute("label") || periodSwitcher.innerText.trim();
      }

      const items = [];
      const seenDates = new Set();

      // A. Cek tabel standar
      const tableRows = document.querySelectorAll("table tbody tr, .v-table tbody tr");
      if (tableRows && tableRows.length > 0) {
        tableRows.forEach((row) => {
          const rowText = row.innerText || "";
          const date = parseIndonesianDateToIso(rowText);
          if (!date || seenDates.has(date)) return;

          const cells = Array.from(row.querySelectorAll("td")).map((c) => c.innerText.trim());
          const fullRowLower = rowText.toLowerCase();

          let status = "PRESENT";
          let approval = null;
          let inTime = null;
          let outTime = null;

          if (fullRowLower.includes("libur") || fullRowLower.includes("dayoff") || fullRowLower.includes("holiday")) status = "DAYOFF";
          else if (fullRowLower.includes("tidak hadir") || fullRowLower.includes("alpha") || fullRowLower.includes("absent")) status = "ABSENT";
          else if (fullRowLower.includes("izin") || fullRowLower.includes("sakit") || fullRowLower.includes("cuti")) status = "ON_LEAVE";
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

      // B. Cek tombol kalender Monev
      const calendarDays = document.querySelectorAll(".calendar-day-button, [class*='calendar-day'], [data-date]");
      if (calendarDays && calendarDays.length > 0) {
        calendarDays.forEach((el) => {
          const rawText = el.getAttribute("aria-label") || el.getAttribute("data-date") || el.getAttribute("title") || el.innerText || "";
          const date = parseIndonesianDateToIso(rawText) || el.getAttribute("data-date");
          if (!date || seenDates.has(date)) return;

          const elLower = (rawText + " " + el.className).toLowerCase();
          let status = "PRESENT";
          let approval = null;

          if (elLower.includes("libur") || elLower.includes("dayoff") || elLower.includes("holiday")) status = "DAYOFF";
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

      // C. Cek panel detail
      const detailPanel = document.querySelector(".selected-report-detail, .daily-report-detail, [class*='report-detail']");
      if (detailPanel) {
        const detailText = detailPanel.innerText || "";
        const date = parseIndonesianDateToIso(detailText);
        if (date && !seenDates.has(date)) {
          const detailLower = detailText.toLowerCase();
          let status = "PRESENT";
          let approval = null;
          if (detailLower.includes("libur") || detailLower.includes("dayoff")) status = "DAYOFF";
          else if (detailLower.includes("tidak hadir") || detailLower.includes("alpha")) status = "ABSENT";
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

      let participantName = null;
      const userHeaderEl = document.querySelector(".header-username, .user-name, [class*='user-profile'], .v-avatar ~ span");
      if (userHeaderEl) {
        const nameText = userHeaderEl.innerText.trim();
        if (nameText && nameText.length < 50 && !nameText.includes("\n")) {
          participantName = nameText;
        }
      }

      let readStatus = "SUCCESS";
      let message = `Berhasil membaca ${items.length} catatan presensi dari DOM portal Monev.`;

      if (items.length === 0) {
        if (!isRiwayatPage) {
          readStatus = "NOT_ON_RIWAYAT_PAGE";
          message = "Tab Monev aktif, namun belum berada di menu 'Riwayat Kehadiran'. Silakan buka menu Riwayat Kehadiran di portal Monev.";
        } else {
          readStatus = "EMPTY_OR_UNRECOGNIZED";
          message = "Belum ada elemen presensi yang selesai dimuat di layar. Tunggu beberapa detik hingga tabel/kalender tampil sempurna, lalu klik kembali.";
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
          warning: "Data ini dibaca langsung dari periode aktif di layar portal Monev Anda.",
        },
        participantName,
        recordsCount: items.length,
        attendances: items,
      };
    } catch (err) {
      return {
        readStatus: "ERROR",
        message: "Kendala pembacaan DOM: " + (err.message || String(err)),
        timestamp: new Date().toISOString(),
        attendances: [],
      };
    }
  }

  // 2. Cek apakah ada tab portal Monev yang terbuka
  async function checkMonevTabs() {
    try {
      const tabs = await chrome.tabs.query({
        url: "*://monev.maganghub.kemnaker.go.id/*",
      });

      if (tabs.length > 0) {
        const activeTab = tabs[0];
        const isRiwayat = activeTab.url.includes("riwayat");
        tabStatusEl.innerHTML = `
          <span style="color: #34d399;">● Tab Monev Terdeteksi</span>
          <div style="color: #94a3b8; font-size: 10px; font-weight: normal; margin-top: 2px;">
            ${isRiwayat ? "Sedang membuka Riwayat Kehadiran" : "Halaman: " + (activeTab.title || "").slice(0, 30)}
          </div>
        `;
        return tabs[0];
      } else {
        tabStatusEl.innerHTML = `
          <span style="color: #f87171;">● Tab Portal Monev Belum Dibuka</span>
          <div style="color: #94a3b8; font-size: 10px; font-weight: normal; margin-top: 2px;">
            Buka portal resmi Monev di peramban Anda.
          </div>
        `;
        return null;
      }
    } catch {
      tabStatusEl.innerText = "Mode Ekstensi";
      return null;
    }
  }

  // Helper aman mencari tab website MAA tanpa Match Pattern syntax error
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
    } catch {
      return [];
    }
  }

  // 3. Render data DOM ke antarmuka popup
  function renderDomData(data) {
    if (!data) return;
    currentDomData = data;

    const timeStr = data.timestamp
      ? new Date(data.timestamp).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      : "-";

    if (data.readStatus === "SUCCESS") {
      readStatusTextEl.innerHTML = `
        <span style="color: #34d399;">✓ Pembacaan Berhasil (${timeStr})</span><br>
        <span style="color: #94a3b8;">${data.paginationInfo?.periodLabel || "Periode Aktif"}</span>
      `;
      recordsContainerEl.style.display = "block";
      recordsCountEl.innerText = `${data.attendances?.length || 0} Catatan Terdeteksi di Layar:`;
      forwardToMaaBtn.style.display = "block";

      recordsListEl.innerHTML = (data.attendances || [])
        .map((item) => {
          const appBadge = item.approval_status ? ` &bull; ${item.approval_status}` : "";
          const color = item.status === "PRESENT" ? "#34d399" : item.status === "DAYOFF" ? "#c084fc" : item.status === "ON_LEAVE" ? "#38bdf8" : "#fb7185";
          return `
            <div class="record-item">
              <span><b>${item.date}</b></span>
              <span style="color: ${color};">
                ${item.status}${appBadge}
              </span>
            </div>
          `;
        })
        .join("");
    } else if (data.readStatus === "LOADING") {
      readStatusTextEl.innerHTML = `<span style="color: #fbbf24;">⏳ ${data.message}</span>`;
      recordsContainerEl.style.display = "none";
      forwardToMaaBtn.style.display = "none";
    } else {
      readStatusTextEl.innerHTML = `
        <span style="color: #f87171;">⚠ ${data.message || "Data belum terbaca"}</span><br>
        <span style="color: #64748b; font-size: 10px;">Terakhir diperiksa: ${timeStr}</span>
      `;
      recordsContainerEl.style.display = "none";
      forwardToMaaBtn.style.display = "none";
    }
  }

  // 4. Muat data terakhir dari storage
  chrome.storage.local.get(["latestDomData"], (res) => {
    if (res.latestDomData) {
      renderDomData(res.latestDomData);
    }
  });

  await checkMonevTabs();

  // 5. Tombol: Baca DOM Presensi di Tab Aktif (Eksekusi Langsung yang Anti-Gagal)
  readDomBtn.addEventListener("click", async () => {
    readDomBtn.innerText = "Membaca Tampilan Layar...";
    readDomBtn.disabled = true;
    actionMsgEl.style.display = "none";

    try {
      const tab = await checkMonevTabs();
      if (!tab || !tab.id) {
        throw new Error("Tab portal Monev belum dibuka di browser ini. Silakan buka portal Monev terlebih dahulu.");
      }

      // Gunakan chrome.scripting.executeScript langsung di tab target
      // Ini 100% andal, tidak bergantung pada background worker atau listener
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractAttendanceFromDOMDirectly,
      });

      const extracted = results && results[0] ? results[0].result : null;

      readDomBtn.innerText = "Baca DOM Presensi di Tab Aktif";
      readDomBtn.disabled = false;

      if (extracted) {
        // Simpan ke storage lokal ekstensi
        await chrome.storage.local.set({ latestDomData: extracted });

        // Tampilkan ke antarmuka popup
        renderDomData(extracted);

        // Jika ada tab MAA yang terbuka, otomatis teruskan data ke tab tersebut
        try {
          const maaTabs = await findMaaTabs();
          for (const mt of maaTabs) {
            if (mt.id) {
              chrome.tabs.sendMessage(mt.id, {
                action: "DOM_ATTENDANCE_UPDATE",
                data: extracted,
              }).catch(() => {});
            }
          }
        } catch {}
      } else {
        actionMsgEl.style.display = "block";
        actionMsgEl.innerHTML = `<span style="color: #f87171;">Tidak dapat membaca elemen halaman. Pastikan tab Monev sudah selesai memuat tampilan.</span>`;
      }
    } catch (err) {
      readDomBtn.innerText = "Baca DOM Presensi di Tab Aktif";
      readDomBtn.disabled = false;
      actionMsgEl.style.display = "block";
      actionMsgEl.innerHTML = `<span style="color: #f87171;">${err.message || String(err)}</span>`;
    }
  });

  // 6. Tombol: Buka Riwayat Presensi Monev
  openMonevBtn.addEventListener("click", async () => {
    const targetUrl = "https://monev.maganghub.kemnaker.go.id/dashboard/riwayat";
    const tabs = await chrome.tabs.query({ url: "*://monev.maganghub.kemnaker.go.id/*" });
    if (tabs.length > 0 && tabs[0].id) {
      await chrome.tabs.update(tabs[0].id, { url: targetUrl, active: true });
    } else {
      await chrome.tabs.create({ url: targetUrl, active: true });
    }
  });

  // 7. Tombol: Teruskan ke Web MAA
  forwardToMaaBtn.addEventListener("click", async () => {
    if (!currentDomData || !currentDomData.attendances) return;

    forwardToMaaBtn.innerText = "Meneruskan...";
    forwardToMaaBtn.disabled = true;
    actionMsgEl.style.display = "block";
    actionMsgEl.innerHTML = "<span style=\"color: #94a3b8;\">Meneruskan data DOM ke dashboard MAA...</span>";

    try {
      const maaTabs = await findMaaTabs();

      if (maaTabs.length > 0) {
        let sentCount = 0;
        for (const mt of maaTabs) {
          if (mt.id) {
            chrome.tabs.sendMessage(mt.id, {
              action: "DOM_ATTENDANCE_UPDATE",
              data: currentDomData,
            }).catch(() => {});
            sentCount++;
          }
        }

        // Bawa tab MAA ke depan (fokus)
        if (maaTabs[0].id) {
          await chrome.tabs.update(maaTabs[0].id, { active: true });
        }

        actionMsgEl.innerHTML = `
          <span style="color: #34d399;">
            ✓ Berhasil diteruskan ke ${sentCount} tab Dashboard MAA (${currentDomData.attendances.length} catatan).
          </span>
        `;
      } else {
        // Tab MAA belum terbuka, buka tab baru ke localhost:3000
        await chrome.tabs.create({ url: "http://localhost:3000", active: true });
        actionMsgEl.innerHTML = `
          <span style="color: #38bdf8;">
            Tab Dashboard MAA telah dibuka. Data (${currentDomData.attendances.length} catatan) tersimpan di ekstensi dan siap disinkronkan.
          </span>
        `;
      }
    } catch (err) {
      actionMsgEl.innerHTML = `<span style="color: #f87171;">Kendala pengiriman: ${err.message}</span>`;
    } finally {
      forwardToMaaBtn.innerText = "Teruskan ke Web MAA";
      forwardToMaaBtn.disabled = false;
    }
  });
});
