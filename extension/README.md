# MAA Companion Extension (Manifest V3)

Ekstensi peramban resmi pendamping **MagangHub Attendance Assistant (MAA)** untuk membaca data presensi nyata dari portal Monev MagangHub langsung melalui sesi peramban Anda.

## Mengapa Ekstensi Ini Dibutuhkan?

1. **Keamanan Same-Origin Policy (SOP)**: Portal login Monev menyimpan sesi Anda di domain `kemnaker.go.id`. Spesifikasi keamanan browser melarang website eksternal (seperti `http://localhost:3000`) membaca cookie tersebut secara cross-site.
2. **Ketiadaan OAuth 2.0 Publik**: Kemnaker RI tidak menyediakan pendaftaran Client OAuth untuk pengembang pihak ketiga.
3. **Privasi Penuh**: Dengan ekstensi ini, Anda **TIDAK PERLU** menyalin token Bearer dari DevTools, tidak perlu membagikan cookie, dan tidak perlu memberikan kata sandi.

## Cara Pemasangan di Chrome / Microsoft Edge

1. Buka peramban Anda dan masuk ke menu Ekstensi:
   - Google Chrome: Buka `chrome://extensions`
   - Microsoft Edge: Buka `edge://extensions`
2. Aktifkan **Mode Pengembang (Developer Mode)** di pojok kanan atas.
3. Klik tombol **Muat yang belum dibongkar (Load unpacked)**.
4. Pilih folder `extension/` di dalam proyek ini (`d:\MagangHub Attendance Assistant (MAA)\extension`).
5. Ekstensi **MAA MagangHub Attendance Companion** siap digunakan!

## Cara Penggunaan

1. Buka portal resmi Monev MagangHub di peramban Anda: `https://monev.maganghub.kemnaker.go.id/login` dan lakukan login dengan akun Anda.
2. Klik ikon ekstensi MAA di toolbar peramban.
3. Status akan menunjukkan: `● Sesi Monev Terdeteksi Aktif`.
4. Klik tombol **Periksa Presensi Monev Nyata** untuk memverifikasi absensi hari ini langsung dari API resmi Kemnaker.
5. Klik tombol hijau **Sinkronkan ke Web MAA (Localhost)**:
   - Data profil peserta dan catatan absensi asli akan disinkronkan ke database lokal MAA.
   - Tab `http://localhost:3000` akan otomatis diperbarui dan langsung menampilkan **Attendance Dashboard** tanpa perlu login ulang!
