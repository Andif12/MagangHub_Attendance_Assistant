document.addEventListener("DOMContentLoaded", async () => {
  const sessionStatusEl = document.getElementById("sessionStatus");
  const attendanceResultEl = document.getElementById("attendanceResult");
  const checkBtn = document.getElementById("checkBtn");
  const syncMaaBtn = document.getElementById("syncMaaBtn");
  const syncResultEl = document.getElementById("syncResult");
  const participantIdInput = document.getElementById("participantIdInput");

  // Simpan / Muat participant ID jika pernah diinput manual
  const savedParticipantId = localStorage.getItem("maa_participant_id") || "";
  if (participantIdInput) {
    participantIdInput.value = savedParticipantId;
    participantIdInput.addEventListener("input", (e) => {
      localStorage.setItem("maa_participant_id", e.target.value.trim());
    });
  }

  // 1. Deteksi sesi login Monev
  async function checkMonevSession() {
    try {
      const monevTabs = await chrome.tabs.query({
        url: "*://monev.maganghub.kemnaker.go.id/*",
      });

      if (monevTabs.length > 0) {
        sessionStatusEl.innerHTML = `
          <div style='color: #34d399; font-weight: 700;'>● Tab Monev Terdeteksi Aktif</div>
          <div style='color: #94a3b8; font-size: 11px; margin-top: 4px; line-height: 1.3;'>
            <b>Fitur Langsung Masuk (Zero-Click) Aktif:</b> Buka <a href="http://localhost:3000" target="_blank" style="color: #38bdf8; text-decoration: underline;">localhost:3000</a> untuk masuk langsung tanpa harus klik popup ini lagi!
          </div>
        `;
        return true;
      }

      const allCookies = await chrome.cookies.getAll({});
      const hasCookies = allCookies.some(
        (c) => c.domain.includes("kemnaker.go.id") || c.domain.includes("maganghub")
      );

      if (hasCookies) {
        sessionStatusEl.innerHTML =
          "<span style='color: #38bdf8;'>● Sesi Cookie Monev Terdeteksi</span>";
        return true;
      }

      sessionStatusEl.innerHTML =
        "<span style='color: #fb923c;'>● Belum ada tab monev.maganghub.kemnaker.go.id yang aktif</span>";
      return false;
    } catch {
      sessionStatusEl.innerText = "Mode Peramban";
      return false;
    }
  }

  await checkMonevSession();

  // 2. Fungsi untuk mengambil data asli dari tab Monev aktif
  async function fetchFromMonevTab() {
    const tabs = await chrome.tabs.query({
      url: "*://monev.maganghub.kemnaker.go.id/*",
    });

    if (!tabs || tabs.length === 0) {
      throw new Error(
        "Tab portal Monev belum terbuka. Buka https://monev.maganghub.kemnaker.go.id di tab peramban Anda, pastikan sudah login, lalu klik tombol ini kembali."
      );
    }

    const tabId = tabs[0].id;

    // Coba kirim pesan ke content script di tab Monev
    try {
      const resp = await chrome.tabs.sendMessage(tabId, { action: "FETCH_MONEV_DATA" });
      if (resp && resp.success) return resp.data;
      if (resp && !resp.success) throw new Error(resp.error);
    } catch {
      // Jika content script belum terinjeksi (misal tab dibuka sebelum ekstensi direload), injeksikan sekarang
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ["content-monev.js"],
        });
        const resp = await chrome.tabs.sendMessage(tabId, { action: "FETCH_MONEV_DATA" });
        if (resp && resp.success) return resp.data;
        throw new Error(resp?.error || "Gagal berkomunikasi dengan halaman Monev.");
      } catch (injErr) {
        throw new Error(
          "Tidak dapat membaca halaman Monev: " + (injErr.message || String(injErr))
        );
      }
    }
  }

  // 3. Tombol Periksa Presensi Hari Ini
  checkBtn.addEventListener("click", async () => {
    checkBtn.innerText = "Menghubungi Monev...";
    checkBtn.disabled = true;
    attendanceResultEl.style.display = "none";

    try {
      const data = await fetchFromMonevTab();
      const records = data.attendances || [];
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Makassar",
      }).format(new Date());

      const todayRecord = records.find((r) => r.date === today);
      const todayDayOfWeek = new Date().getDay(); // 0: Sun, 6: Sat
      const isWeekend = todayDayOfWeek === 0 || todayDayOfWeek === 6;

      attendanceResultEl.style.display = "block";
      if (!todayRecord) {
        if (isWeekend) {
          attendanceResultEl.innerHTML = `
            <div class='badge' style='background: rgba(168, 85, 247, 0.2); color: #c084fc;'>Hari Libur (Akhir Pekan)</div>
            <div style='color: #94a3b8; font-size: 11px; margin-top: 4px;'>Akun: ${data.user.name} &bull; Tgl: ${today}</div>
          `;
        } else {
          attendanceResultEl.innerHTML = `
            <div class='badge badge-action'>Belum Diisi (Hari Kerja)</div>
            <div style='color: #94a3b8; font-size: 11px; margin-top: 4px;'>Akun: ${data.user.name} &bull; Tgl: ${today}</div>
          `;
        }
      } else {
        const status = String(todayRecord.status || "").toUpperCase();
        const approval = String(todayRecord.approval_status || "").toUpperCase();

        let categoryText = "Menunggu Tindakan Mentor";
        let categoryColor = "background: rgba(245, 158, 11, 0.2); color: #fbbf24;";

        if (approval === "REJECTED" || status === "REJECTED") {
          categoryText = "Kehadiran Ditolak";
          categoryColor = "background: rgba(239, 68, 68, 0.2); color: #f87171;";
        } else if (status === "REVISION" || status === "DRAFT" || (todayRecord.notes && todayRecord.notes.includes("revisi"))) {
          categoryText = "Perlu Tindakan Anda";
          categoryColor = "background: rgba(249, 115, 22, 0.2); color: #fb923c;";
        } else if (/^(ON_LEAVE|PERMISSION|IZIN|SICK|SAKIT)$/.test(status)) {
          if (approval === "APPROVED") {
            categoryText = "Izin disetujui";
            categoryColor = "background: rgba(6, 182, 212, 0.2); color: #22d3ee;";
          } else {
            categoryText = "Menunggu Tindakan Mentor";
            categoryColor = "background: rgba(245, 158, 11, 0.2); color: #fbbf24;";
          }
        } else if (/^(ABSENT|ALPHA|TIDAK_HADIR)$/.test(status)) {
          categoryText = "Tidak Hadir";
          categoryColor = "background: rgba(244, 63, 94, 0.2); color: #fb7185;";
        } else if (status === "PRESENT" || status === "HADIR") {
          if (approval === "APPROVED") {
            categoryText = "Hadir disetujui";
            categoryColor = "background: rgba(16, 185, 129, 0.2); color: #34d399;";
          } else {
            categoryText = "Menunggu Tindakan Mentor";
            categoryColor = "background: rgba(245, 158, 11, 0.2); color: #fbbf24;";
          }
        }

        attendanceResultEl.innerHTML = `
          <div class='badge' style='${categoryColor}'>
            ${categoryText}
          </div>
          <div style='color: #94a3b8; font-size: 11px; margin-top: 4px;'>
            Akun: ${data.user.name} &bull; Tgl: ${todayRecord.date}
          </div>
        `;
      }
    } catch (err) {
      attendanceResultEl.style.display = "block";
      attendanceResultEl.innerHTML = `
        <div style='color: #f87171; line-height: 1.4;'>
          ${err.message}<br>
          <a href="https://monev.maganghub.kemnaker.go.id" target="_blank" style="color: #38bdf8; text-decoration: underline;">
            Buka Tab Monev Sekarang
          </a>
        </div>
      `;
    } finally {
      checkBtn.innerText = "Periksa Presensi Monev Nyata";
      checkBtn.disabled = false;
    }
  });

  // 4. Tombol Sinkronkan ke Web MAA (Localhost:3000)
  if (syncMaaBtn) {
    syncMaaBtn.addEventListener("click", async () => {
      syncMaaBtn.innerText = "Menyinkronkan ke MAA...";
      syncMaaBtn.disabled = true;
      syncResultEl.style.display = "block";
      syncResultEl.innerHTML =
        "<span style='color: #94a3b8;'>Membaca sesi asli dari tab Monev aktif...</span>";

      try {
        // A. Ambil data asli dari tab Monev
        const data = await fetchFromMonevTab();
        const user = data.user;
        const attendances = data.attendances || [];

        syncResultEl.innerHTML = `
          <span style='color: #94a3b8;'>
            Terhubung sebagai <b>${user.name}</b>. Mengirim ${attendances.length} absensi ke MAA...
          </span>
        `;

        // B. Kirim ke backend MAA (localhost:3000)
        const syncRes = await fetch("http://localhost:3000/api/auth/companion-sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            user: { id: user.id, name: user.name, email: user.email },
            attendances: attendances,
          }),
        });

        if (!syncRes.ok) {
          const errText = await syncRes.text();
          let errMsg = `HTTP ${syncRes.status}`;
          try {
            const errJson = JSON.parse(errText);
            errMsg = errJson.error || errMsg;
          } catch {}
          throw new Error(`Server MAA merespons error: ${errMsg}`);
        }

        const syncJson = await syncRes.json();
        if (!syncJson.success) {
          throw new Error(syncJson.error || "Gagal memproses data di server MAA.");
        }

        // C. Set cookie sesi langsung di peramban untuk domain localhost:3000
        if (syncJson.token) {
          try {
            await chrome.cookies.set({
              url: "http://localhost:3000",
              name: "maa_session",
              value: syncJson.token,
              path: "/",
              sameSite: "lax",
            });
          } catch (cookieErr) {
            console.warn("Gagal menyetel cookie:", cookieErr);
          }
        }

        // D. Arahkan tab localhost:3000 langsung ke Dashboard dengan token bridge
        const targetUrl = `http://localhost:3000/?token=${encodeURIComponent(syncJson.token)}&sync=1`;

        try {
          const localhostTabs = await chrome.tabs.query({
            url: "*://localhost:3000/*",
          });
          if (localhostTabs.length > 0) {
            await chrome.tabs.update(localhostTabs[0].id, {
              url: targetUrl,
              active: true,
            });
          } else {
            await chrome.tabs.create({ url: targetUrl, active: true });
          }
        } catch (tabErr) {
          console.warn("Gagal mengarahkan tab localhost:", tabErr);
        }

        syncResultEl.innerHTML = `
          <div style='color: #34d399; font-weight: 600; line-height: 1.4;'>
            ✓ Berhasil terhubung sebagai <b>${user.name}</b>!<br>
            ${syncJson.recordsSaved} absensi disinkronkan.<br>
            Tab localhost:3000 otomatis dialihkan ke Dashboard.
          </div>
        `;
      } catch (err) {
        syncResultEl.innerHTML = `
          <div style='color: #f87171; line-height: 1.4;'>
            <b>Gagal:</b> ${err.message}<br>
            <a href="https://monev.maganghub.kemnaker.go.id" target="_blank" style="color: #38bdf8; text-decoration: underline; margin-top: 4px; display: inline-block;">
              Buka Portal Monev di Tab Baru
            </a>
          </div>
        `;
      } finally {
        syncMaaBtn.innerText = "Sinkronkan ke Web MAA (Localhost)";
        syncMaaBtn.disabled = false;
      }
    });
  }
});
