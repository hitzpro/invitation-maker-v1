<div align="center">

# Undangan Digital — Editorial Wedding Invitation Maker

Platform pembuat undangan pernikahan digital bergaya **Modern Minimalism Editorial** dengan formulir otomatis 4 langkah, editor visual *live preview* (Undo/Redo, kustomisasi warna, tipografi, ornamen SVG, musik latar), manajemen tamu personal (`?to=Nama`), distribusi WhatsApp, RSVP, ucapan doa, dan amplop digital.

[![Astro](https://img.shields.io/badge/Astro-7.x-BC52EE?style=flat-square&logo=astro&logoColor=white)](https://astro.build)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22.23-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org)

<br />

| Pilih Panduan Sesuai Latar Belakang Anda |
| :---: |
| [👤 **Tab 1: Panduan Pemula (Non-Developer)**](#-tab-1-panduan-pemula-non-developer) &nbsp;&nbsp;·&nbsp;&nbsp; [💻 **Tab 2: Panduan Developer (Technical)**](#-tab-2-panduan-developer-technical) |

</div>

---

> [!IMPORTANT]
> **Tentang Versi Demo Online vs Versi Lokal**
>
> Versi yang di-deploy secara publik sengaja dijalankan dalam **Mode Demo Showcase** (`/demo`) agar pengunjung dapat melihat hasil undangan terlebih dahulu. Untuk membuat akun, membuka editor visual, mengunggah foto/musik, mengelola daftar tamu, dan menyimpan data undangan Anda sendiri, **unduh (clone) repositori ini dan jalankan di komputer atau server pribadi Anda**.

---

## Ringkasan Fitur Utama

- **2 Cara Pembuatan Undangan**: **Formulir Otomatis** (4 langkah cepat) dan **Editor Visual Manual** (*live preview* desktop & ponsel, *Undo/Redo*, ubah urutan *section*, warna, font, pola latar, dan ornamen).
- **Undangan Interaktif**: *Cover slideshow* dengan animasi *fade-in & zoom-in*, *countdown* acara otomatis, kisah cinta, galeri *lightbox zoom*, peta lokasi & simpan ke kalender (`.ics`), serta musik latar (`MP3`, `M4A`, `OGG`).
- **Tamu, RSVP & Amplop Digital**: Tautan sapaan personal (`/?to=Nama+Tamu`), pelacakan kirim pesan WhatsApp, formulir konfirmasi kehadiran + ucapan doa dengan ekspor CSV, serta nomor rekening & QRIS.
- **Wizard Instalasi Otomatis (`npm run setup`)**: Tidak perlu repot mengedit file `.env` manual atau menginstall Docker/WSL — cukup jalankan satu perintah di terminal, pilih database, dan jika ada error tersedia menu solusi otomatis.
- **Sinkronisasi Update 1-Klik**: Ketika ada fitur baru di GitHub, pengguna lokal cukup menekan tombol sinkronisasi di **Panel Admin** tanpa perlu *clone* ulang atau kehilangan data.

---

<a id="-tab-1-panduan-pemula-non-developer"></a>

<details open>
<summary><h2>👤 TAB 1 — Panduan Pemula (Non-Developer / Pengguna Umum)</h2></summary>

Panduan ini ditulis khusus untuk Anda yang **belum terbiasa dengan pemrograman**. Tidak perlu install Docker atau mengatur WSL yang rumit, dan tidak perlu edit file pengaturan manual — semuanya dipandu otomatis oleh **Wizard Instalasi**.

### A. Persiapan Awal (Cukup Install 2 Software Gratis)

Sebelum mengunduh aplikasi, pastikan **2 software gratis** ini sudah terpasang di komputer Windows / Mac Anda:

1. **Git** — Alat untuk mengunduh proyek dari GitHub dan menerima pembaruan fitur nantinya.
   - Unduh di: **[git-scm.com/downloads](https://git-scm.com/downloads)**
   - Saat instalasi di Windows, klik **Next** terus hingga **Finish**.
2. **Node.js (Versi 22 LTS atau lebih baru)** — Mesin untuk menjalankan aplikasi.
   - Unduh di: **[nodejs.org](https://nodejs.org)** (pilih tombol hijau versi **LTS / 22+**).
   - Klik **Next** terus hingga selesai.

> [!TIP]
> **Bagaimana dengan Database? Apakah harus install Docker?**
> **TIDAK PERLU!** Di dalam Wizard nanti tersedia pilihan **Cloud Database Gratis (Neon / Supabase)** — Anda cukup daftar gratis 2 menit lewat browser, salin 1 link, lalu tempel ke terminal. Tanpa install Docker, tanpa WSL, dan ringan untuk semua laptop!
> *(Jika Anda tetap punya Docker Desktop atau PostgreSQL lokal, opsi itu juga tetap tersedia di dalam Wizard).*

---

### B. Langkah 1 — Siapkan Link Database Gratis (2 Menit, Tanpa Install Apa-apa)

1. Buka **[neon.tech](https://neon.tech)** (atau **[supabase.com](https://supabase.com)**) dan daftar gratis menggunakan akun Google / GitHub.
2. Buat 1 project baru (bebas beri nama `undangan`).
3. Cari tombol **Connect** / **Connection String**, lalu salin link PostgreSQL yang diawali dengan `postgresql://...`. Simpan dulu di clipboard (`Ctrl+C`).

---

### C. Langkah 2 — Jalankan 1 Perintah Instalasi di Terminal

1. Buka folder tempat Anda ingin menyimpan proyek (misalnya di `Documents`).
2. Buka **Command Prompt (CMD)** atau **Terminal** di dalam folder tersebut:
   - *Tips Windows*: Buka folder di File Explorer → klik kolom alamat di atas → ketik `cmd` → tekan **Enter**.
3. Salin dan jalankan **1 baris perintah berikut** *(ganti `<username-anda>` dengan username GitHub pemilik repositori)*:

```bash
git clone https://github.com/<username-anda>/undangan-digital.git && cd undangan-digital && npm run setup
```

> [!NOTE]
> **Apa yang otomatis dilakukan oleh `npm run setup`?**
> 1. Mengunduh paket aplikasi (`npm install`).
> 2. Membuat file pengaturan `.env` dan kunci keamanan secara otomatis (tidak perlu edit Notepad!).
> 3. Menanyakan pilihan database (**Pilih nomor `[1]` Cloud Database Gratis** lalu tempel link dari Langkah 1).
> 4. Menguji koneksi dan membuat semua tabel database otomatis.
> 5. Jika terjadi error (salah link, butuh SSL, Docker mati, dll), Wizard langsung menawarkan **menu pilihan solusi otomatis** di layar tanpa langsung keluar!
> 6. Menawarkan untuk langsung menyalakan server aplikasi.

---

### D. Langkah 3 — Buka Aplikasi & Buat Akun Pertama

1. Jika Wizard sudah menjalankan server (atau jika Anda menjalankannya nanti dengan mengetik `npm run dev`), buka browser Anda dan kunjungi:
   👉 **`http://localhost:3000`**
2. Klik **Mulai Gratis** (atau buka **`http://localhost:3000/register`**) untuk mendaftar akun pertama Anda.
   - **Otomatis Jadi Admin:** Akun **pertama** yang Anda daftarkan di komputer Anda langsung menjadi **Administrator**.
   - Anda sudah bisa langsung membuat undangan, mengatur desain di Editor Visual, dan mempublikasikannya!

*(Besok jika ingin membuka aplikasinya lagi setelah komputer dimatikan: buka CMD di folder `undangan-digital`, lalu cukup ketik `npm run dev`).*

---

### E. Cara Mendapatkan Update Fitur Baru (1-Klik!)

Setiap kali ada fitur atau tema baru yang dirilis ke GitHub:

1. Masuk ke **Panel Admin** → **`http://localhost:3000/admin`**.
2. Pada kotak **Pembaruan & Sinkronisasi**, klik **Cek Pembaruan**.
3. Jika ada versi baru, klik **Sinkronkan Update** dan tunggu hingga selesai.
4. Tekan **`Ctrl + Shift + R`** (Windows) atau **`Cmd + Shift + R`** (Mac) di browser untuk *Hard Refresh*.

> [!TIP]
> **Data Anda Aman:** Pengaturan `.env`, seluruh foto & musik di `data/uploads/`, dan data undangan di database Anda tidak akan pernah tertimpa saat sinkronisasi.

---

### F. Solusi Masalah Umum

| Masalah yang Terjadi | Cara Mengatasinya |
| :--- | :--- |
| Muncul tulisan *"git/npm is not recognized"* | Pastikan **Git** dan **Node.js 22+** sudah selesai diinstall, lalu **tutup dan buka ulang** jendela CMD/Terminal. |
| Salah memasukkan link database saat setup | Jalankan lagi `npm run setup` di terminal — Anda bisa langsung pilih ubah koneksi atau pindah ke opsi lain. |
| Muncul *Mode Demo Showcase* di komputer sendiri | Pastikan proses `npm run setup` selesai hingga tahap migrasi database (yang otomatis mengatur `DEMO_MODE=false` di `.env`). |
| Lupa password atau akun Admin | Daftar akun baru di `/register`, lalu jalankan `npm run make-admin -- emailbaru@contoh.com` di terminal. |

</details>

---

<a id="-tab-2-panduan-developer-technical"></a>

<details>
<summary><h2>💻 TAB 2 — Panduan Developer (Technical Documentation)</h2></summary>

Dokumentasi teknis untuk *setup* lokal, arsitektur Demo vs Self-Hosted, skema database, skrip CLI, dan *deployment* produksi.

### 1. Stack Teknologi

| Lapisan | Teknologi |
| :--- | :--- |
| **Framework & SSR** | Astro 7 (`output: 'server'`, adapter `@astrojs/node`) |
| **Styling & UI** | Tailwind CSS v4 (`@tailwindcss/vite`), Fontsource (`Playfair Display`, `DM Sans`, `Inter`, `Great Vibes`) |
| **Database & ORM** | PostgreSQL 16 + Drizzle ORM (`drizzle-orm/node-postgres`) + `drizzle-kit` |
| **Auth & Security** | Cookie-based session, `@node-rs/argon2`, Zod validation, CSP & Same-Origin checks |
| **Media Processing** | `sharp` (resize & konversi WebP otomatis), validasi *magic bytes* upload & sanitasi SVG |

---

### 2. Prasyarat & Quickstart Lokal

**Prasyarat:** `Node.js >= 22.23.4`, `Git`, dan PostgreSQL (bisa via Cloud Postgres seperti Neon/Supabase, `docker compose`, atau PostgreSQL lokal).

#### Opsi A — Menggunakan Interactive Setup Wizard (Disarankan)
```bash
git clone https://github.com/<username-anda>/undangan-digital.git
cd undangan-digital
npm run setup
```
`scripts/setup.js` hanya bergantung pada modul bawaan Node.js sehingga bisa dijalankan sebelum `npm install`: otomatis memasang dependensi, membuat `.env` + `APP_SECRET` acak, menguji koneksi DB (`Cloud` / `Docker` / `Local Postgres`) dengan recovery interaktif, menjalankan `npm run db:migrate`, dan menyalakan `npm run dev`.

#### Opsi B — Setup Manual
```bash
git clone https://github.com/<username-anda>/undangan-digital.git
cd undangan-digital
cp .env.example .env
# Isi DATABASE_URL, APP_SECRET (>= 16 char), dan DEMO_MODE=false
docker compose up -d          # opsional jika pakai Docker Compose (port 5433)
npm install
npm run db:migrate
npm run dev
```

*Akun pertama yang terdaftar melalui `/register` pada database kosong otomatis diberi peran `admin` secara atomik.*

---

### 3. Referensi Environment Variables (`.env`)

| Variabel | Wajib | Keterangan & Nilai Default |
| :--- | :---: | :--- |
| `APP_PORT` | Tidak | Port HTTP server lokal/produksi (default: `3000`). |
| `APP_SECRET` | **Ya** (Prod) | Kunci rahasia server minimal 16 karakter acak. |
| `APP_URL` | **Ya** | Base URL publik/lokal untuk Open Graph & proxy (mis. `http://localhost:3000`). |
| `DATABASE_URL` | **Ya** (Lokal) | PostgreSQL connection string (`postgresql://undangan:undangan_dev_password@localhost:5433/undangan` untuk `docker-compose.yml`). |
| `UPLOAD_DIR` | Tidak | Direktori simpan unggahan foto/audio/SVG (rekomendasi: `./data/uploads`). |
| `MAX_UPLOAD_SIZE_MB` | Tidak | Batas ukuran unggah foto dalam MB (default `20`). |
| `MAX_AUDIO_SIZE_MB` | Tidak | Batas ukuran unggah audio latar dalam MB (default `10`). |
| `DEMO_MODE` | Tidak | `true` mengaktifkan mode showcase publik; `false` untuk mode penuh. Jika kosong, otomatis `true` bila database belum terhubung. |
| `UPSTREAM_BRANCH` | Tidak | Override nama branch Git untuk fitur sinkronisasi update (default mengikuti branch aktif, mis. `main`). |
| `CREATOR_GITHUB_USERNAME` | Tidak | Username GitHub pembuat untuk watermark footer & ikon navbar. |
| `CREATOR_GITHUB_URL` | Tidak | URL profil GitHub pembuat (otomatis diturunkan dari username bila kosong). |
| `CREATOR_REPO_URL` | Tidak | URL repositori GitHub proyek untuk tombol navbar & panduan clone. |
| `OWNER_DASHBOARD_KEY` | Tidak | Passcode rahasia pemilik repositori. `/owner` hanya aktif jika variabel ini diisi di server pemilik. |
| `GITHUB_REPO` | Tidak | Slug repo eksplisit `owner/repo` (otomatis diambil dari `CREATOR_REPO_URL` bila kosong). |
| `GITHUB_TOKEN` | Tidak | GitHub PAT (*Administration / Metadata Read*) untuk membaca grafik 14 hari *clones* & *views* di `/owner`. |
| `CREATOR_TELEMETRY_URL` | Tidak | URL publik server pemilik tempat instalasi lokal mengirim ping anonim harian (`POST /api/telemetry/ping`). |
| `DISABLE_TELEMETRY` | Tidak | Set `true` pada instalasi lokal jika tidak ingin mengirim ping telemetri anonim ke pemilik proyek. |

---

### 4. Arsitektur Mode Demo vs Mode Lokal

- **`DEMO_MODE=true` (atau fallback saat tanpa DB aktif)**:
  - Halaman `/` menampilkan banner **Mode Demo Showcase**, blok perintah *clone*, serta CTA menuju **`/demo`** (`src/pages/demo.astro` + `src/lib/demo.js`).
  - `src/middleware.js` menolak mutasi ke `/api/invitations/*`, `/api/admin/*`, dan *write* pada `/api/public/*` dengan HTTP `403`, serta mengalihkan `/dashboard` & `/admin` ke `/login`.
  - `/login` & `/register` menonaktifkan autentikasi aktif dan menampilkan informasi pengunduhan repositori.
- **`DEMO_MODE=false` (dengan PostgreSQL aktif)**:
  - Seluruh fitur dashboard, formulir otomatis, editor visual, unggahan Sharp/audio/SVG, RSVP, manajemen tamu, serta Panel Admin aktif penuh.
  - Database fallback (`src/db/mock.js`) bersifat opsional via pengecekan filesystem sehingga proyek tetap bersih di berbagai lingkungan *build*.

---

### 5. Referensi NPM Scripts & Utilitas

| Perintah | Fungsi |
| :--- | :--- |
| `npm run setup` | Menjalankan wizard instalasi & pemulihan error interaktif (`scripts/setup.js`). |
| `npm run dev` | Menjalankan Astro dev server pada `0.0.0.0:3000`. |
| `npm run build` | Mem-*build* output SSR ke `dist/`. |
| `npm start` | Menjalankan server produksi (`node dist/server/entry.mjs`). |
| `npm run db:generate` | Menghasilkan file migrasi SQL baru dari perubahan `src/db/schema.js`. |
| `npm run db:migrate` | Menerapkan migrasi SQL di folder `drizzle/` ke PostgreSQL. |
| `npm run db:studio` | Membuka Drizzle Studio untuk inspeksi tabel database. |
| `npm run make-admin -- <email>` | Mempromosikan akun terdaftar menjadi `admin`. |
| `npm run sync` | Menarik pembaruan dari `origin/<branch>` via CLI (`scripts/sync-update.js`). |
| `npm run cleanup` | Membersihkan sesi kedaluwarsa & berkas yatim (`scripts/cleanup.js`). |
| `npm run backup` | Membuat cadangan `pg_dump` + arsip `uploads.tar.gz` (`scripts/backup.sh`). |

---

### 6. Mekanisme Upstream Sync (1-Klik Update)

Fitur sinkronisasi di `/admin` (`src/lib/updater.js` + `src/pages/api/admin/updates.js`) mengeksekusi alur berikut secara aman (`execFile`, validasi admin & *same-origin*, tanpa `shell: true`):

1. `git fetch origin <branch>` & membaca daftar *commit* yang tertinggal (`HEAD..origin/<branch>`).
2. Memastikan *working tree* bersih dari modifikasi file terlacak agar tidak terjadi konflik.
3. Menjalankan `git pull --ff-only origin <branch>`.
4. Mendeteksi *diff*: otomatis menjalankan `npm install` jika `package.json`/lockfile berubah, `npm run db:migrate` jika `drizzle/`/`schema.js` berubah, dan `npm run build` jika folder `dist/` terdeteksi.
5. File `.env` serta direktori `data/uploads/` dan `data/cache/` terlindungi oleh `.gitignore`.

---

### 7. Deployment Produksi (Vercel & Self-Hosted VPS)

#### A. Deploy ke Vercel (Disarankan untuk Demo Showcase + `/owner` + Telemetry Receiver)
Proyek ini mendeteksi `process.env.VERCEL` secara otomatis di `astro.config.mjs` dan beralih ke adapter `@astrojs/vercel`. Cukup impor repositori GitHub di Vercel dan atur *Environment Variables* berikut:

| Variabel | Nilai di Vercel |
| :--- | :--- |
| `DEMO_MODE` | `true` *(karena Vercel serverless tidak menyimpan file `data/uploads/` secara permanen)* |
| `DATABASE_URL` | Connection string Neon / Supabase PostgreSQL agar data ping `/owner` tersimpan permanen |
| `APP_SECRET` | String acak minimal 16 karakter |
| `APP_URL` | URL publik Vercel Anda (mis. `https://nama-proyek.vercel.app`) |
| `OWNER_DASHBOARD_KEY` | Passcode rahasia Anda untuk membuka `/owner` |
| `GITHUB_TOKEN` | GitHub PAT (*Administration: Read-only*) untuk grafik *clones* 14 hari |
| `CREATOR_GITHUB_USERNAME` / `CREATOR_REPO_URL` | Username & URL repo GitHub Anda |

#### B. Self-Hosted Server / VPS (Mode Penuh + Upload Media Lokal)
```bash
npm ci
npm run db:migrate
npm run build
NODE_ENV=production npm start
```

- Gunakan *process manager* seperti **PM2** atau **systemd** dan letakkan di balik reverse proxy (**Nginx / Caddy**) dengan HTTPS aktif.
- Pastikan `APP_URL` di `.env` menggunakan protokol `https://` agar header `Strict-Transport-Security` serta tautan Open Graph (`/og/[slug].jpg`) terbentuk dengan benar.

---

### 8. Mini Dashboard Pemilik & Telemetri Anonim (`/owner`)

Pemilik repositori dapat memantau adopsi proyek melalui rute terproteksi **`/owner`** (`noindex, nofollow`):

1. **Metrik GitHub (`src/lib/github-stats.js`)**: Mengambil jumlah *Stars*, *Forks*, serta grafik trafik **14 hari terakhir (`clones` & `views`)** dari GitHub REST API menggunakan `GITHUB_TOKEN` di sisi server.
2. **Ping Instalasi Lokal Anonim (`/api/telemetry/ping`)**: Saat `CREATOR_TELEMETRY_URL` diisi (mis. di `.env.example` yang di-commit ke GitHub), instalasi lokal (`DEMO_MODE=false`) mengirim ping maksimal 1x per 24 jam berisi UUID acak (`instanceId`), versi aplikasi, OS, dan versi mayor Node.js — **tanpa data pribadi, nama tamu, alamat email, atau isi undangan**.
3. **Opt-Out Lokal**: Pengguna lokal dapat menonaktifkan ping kapan saja dengan mengatur `DISABLE_TELEMETRY=true` di `.env`.
4. **Akses Khusus Pemilik (`/owner`)**: Rute `/owner` otomatis dinonaktifkan (`404`) pada instalasi lain dan **hanya aktif** apabila `OWNER_DASHBOARD_KEY` dikonfigurasi di environment server Anda, dilindungi cookie bertanda tangan `HttpOnly` serta *rate limiting*.

</details>

---

<div align="center">
  <sub>Dibuat dengan ❤️ untuk memudahkan pasangan & pengembang merancang undangan digital secara mandiri.</sub>
</div>
