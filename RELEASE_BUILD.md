Build dan Rilis Aplikasi Menggunakan GitHub Actions

Dokumen ini menjelaskan cara menggunakan GitHub Actions untuk otomatis membangun file installer aplikasi yang siap dikirim ke pelanggan:

macOS: .dmg

Windows: .exe / .msi

Tersedia artifact yang bisa diunduh setiap selesai build

Otomatis membuat GitHub Release saat membuat version tag

1. Workflow yang sudah dikonfigurasi

File workflow berada di:

.github/workflows/build-windows.yml

Nama workflow di GitHub:

Build Desktop Installers

Workflow akan berjalan ketika:

Push ke branch main

Push tag dengan format v*, misalnya v1.0.1

Dijalankan manual melalui tab Actions

2. Konfigurasi API production

Aplikasi perlu mengetahui alamat backend VPS yang digunakan. Saat ini workflow menggunakan:

http://161.248.146.74

Disarankan menggunakan GitHub Secret agar mudah diganti di kemudian hari.

Membuat secret di GitHub

Masuk ke repository GitHub:

Settings -> Secrets and variables -> Actions -> New repository secret

Buat secret berikut:

Name: VITE_API_BASE_URL
Value: http://161.248.146.74

Jika nanti sudah menggunakan domain HTTPS, ubah nilainya menjadi:

https://api.domainanda.com

URL API akan tertanam permanen di dalam aplikasi pada saat proses build. Jika VPS atau domain berubah, aplikasi harus dibangun ulang.

3. Menjalankan build secara manual

Buka repository GitHub:

Actions -> Build Desktop Installers -> Run workflow

Pilih branch main, lalu klik Run workflow.

Setelah proses selesai, buka workflow run dan unduh artifact berikut:

AutoPost-FB-AI-Pro-macOS
AutoPost-FB-AI-Pro-Windows
4. Membuat release untuk pelanggan

Di komputer lokal, jalankan:

git add .
git commit -m "Release desktop installers"
git push origin main

Buat tag versi:

git tag v1.0.1
git push origin v1.0.1

GitHub Actions akan otomatis membangun installer dan membuat release:

Releases -> AutoPost FB AI Pro v1.0.1
5. File mana yang dikirim ke pelanggan?
Pengguna macOS

Kirim file:

.dmg

Contoh:

AutoPost FB AI Pro_1.0.0_aarch64.dmg
Pengguna Windows

Kirim file:

.exe

atau jika tersedia:

.msi
6. Catatan untuk macOS yang belum ditandatangani (unsigned)

Jika belum memiliki Apple Developer Account, pengguna Mac mungkin akan melihat peringatan:

Apple cannot verify developer

Cara membukanya:

Klik kanan aplikasi -> Open -> Open

atau melalui:

System Settings -> Privacy & Security -> Open Anyway

Agar peringatan hilang, perlu menambahkan:

Apple Developer Account

Sertifikat code signing

Proses notarization

7. Checklist sebelum rilis

Pastikan VPS aktif:

curl http://161.248.146.74/health
curl http://161.248.146.74/payments/plans

Hasil endpoint /payments/plans harus menampilkan:

725000
1225000
1725000

Jika sudah benar, buat release dengan tag:

git tag v1.0.1
git push origin v1.0.1
8. Jika build gagal di GitHub

Buka tab Actions, pilih workflow yang gagal, lalu lihat step yang berwarna merah.

Error

	

Cara mengatasi




npm ci gagal

	

Pastikan package-lock.json sudah di-commit, atau workflow akan fallback ke npm install




Rust build gagal

	

Periksa log pada step Build Tauri app




Tidak ada file .exe

	

Periksa konfigurasi Tauri bundle target Windows




Tidak ada file .dmg

	

Periksa step build macOS




Aplikasi mengarah ke API yang salah

	

Periksa secret VITE_API_BASE_URL lalu build ulang
