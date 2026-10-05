# [AGENTS.md](http://AGENTS.md) — checklist-shift

PWA mobile-first (Bahasa Indonesia) untuk SOP shift karyawan F&amp;B. Dokumen ini aturan kerja untuk AI coding agent.

## 1. Sumber Kebenaran (urutan prioritas)

1. [PRD.md](http://PRD.md) : perilaku produk
2. DATABASE\_[SCHEMA.md](http://SCHEMA.md) : struktur data PostgreSQL
3. [TRD.md](http://TRD.md) : keputusan teknis
4. APP\_[FLOW.md](http://FLOW.md) : layar, modal, alur
5. IMPLEMENTATION\_[PLAN.md](http://PLAN.md) : urutan kerja
6. [TESTING.md](http://TESTING.md) : kriteria lulus
7. [UI-UX.md](http://UI-UX.md) : Spesifikasi UI/UX

Jika dokumen bertentangan dengan kode atau dengan instruksi, BERHENTI dan tanyakan. Jangan memilih sendiri.

## 2. Aturan Anti-Overwrite (WAJIB)

- Kerjakan SATU fase IMPLEMENTATION\_[PLAN.md](http://PLAN.md) pada satu waktu, hanya fase yang diminta.
- Sebelum menulis kode: tuliskan asumsi dan daftar file yang akan dibuat/diubah/dihapus, lalu tunggu persetujuan.
- Jangan menimpa file yang sudah ada secara utuh. Ubah dengan edit minimal (diff kecil). Jika perlu menulis ulang &gt;30% sebuah file, minta izin dulu.
- Jangan memformat ulang, mengganti nama, memindahkan, atau merapikan kode di luar lingkup tugas.
- Jangan menghapus file, fungsi, kolom, tabel, atau test tanpa izin eksplisit.
- Jangan mengubah dokumen (PRD, TRD, DATABASE\_SCHEMA, APP\_FLOW, IMPLEMENTATION\_PLAN, TESTING, AGENTS) kecuali diminta. Jika keputusan berubah, usulkan perubahan teksnya, jangan langsung menulis.
- Jangan menambah dependensi, library, atau service baru tanpa izin. Jelaskan alasannya dulu.
- Jangan membuat fitur, halaman, atau abstraksi di luar permintaan (tanpa over-engineering).
- Jangan menyentuh `.env*`, file kredensial, atau konfigurasi deploy.
- Jangan menjalankan migrasi database ke production. Gunakan database/project Supabase uji.
- Jangan commit atau push kecuali diminta.
- Jika tugas terlalu besar, pecah dan usulkan langkah, jangan dikerjakan sekaligus.

## 3. Lingkup Produk

- Peran hanya dua: Petugas dan Admin. Penanggung Jawab (PJ) adalah status per shift, bukan peran.
- TIDAK ADA: penjadwalan, tukar shift, izin/cuti, absensi, penggajian, stok, integrasi POS, aplikasi native, multi-bahasa, 2FA, offline write queue, pembagian MVP.
- Hanya Bahasa Indonesia. Hanya PWA.
- Jangan menambah fitur yang tidak ada di PRD.

## 4. Stack

- Monorepo: `apps/web` (Next.js App Router, TypeScript, Tailwind, shadcn/ui, Lucide), `packages/shared` (tipe + Zod). **Tidak ada `apps/api` atau `apps/gas`.**
- Database: **Supabase PostgreSQL** + **Drizzle ORM**. Semua tabel dalam satu database; cabang dibedakan via `branch_id`.
- Storage foto aktif: **Supabase Storage** bucket `shift-photos` (foto hidup \~7 hari, max 500MB free tier).
- Arsip foto: **Google Drive PDF** mingguan via service account. Nama file: `{branch_name}-{shift_date}-{shift_name}-{branch_id}-{ulid}.pdf`. Folder: `checklist-shift-archive/{branch_code}/`.
- Lock: **PostgreSQL advisory lock** (`pg_try_advisory_xact_lock`). **Tidak ada Redis.**
- Sesi + rate limit: Tabel `sessions` + `pin_fail_attempts` di PostgreSQL + in-memory rate limit per process. **Tidak ada Redis.**
- Offline: Serwist app shell cache saja. **Tidak ada Dexie. Tidak ada offline write queue.**
- Deploy: Vercel **satu project** (Next.js fullstack, API Routes built-in). **Tidak ada project kedua.**
- Tema: Minimalist Corporate.
- Foto: Supabase Storage (aktif) → Google Drive PDF (arsip mingguan). **Sudah diputuskan.**

## 5. Aturan Data (PostgreSQL)

- Baca/tulis kolom berdasarkan nama kolom via Drizzle ORM, bukan urutan.
- DILARANG menghapus baris. Hanya UPDATE status/is\_active/void. Nonaktifkan lewat `is_active=FALSE` atau `status='void'`.
- Waktu disimpan TIMESTAMPTZ UTC. Tampil sesuai zona waktu cabang.
- ID memakai ULID, dibuat di aplikasi dengan library `ulid`.
- Semua tulis atomik: dalam satu `db.transaction(...)`. Satu aksi pengguna = satu transaction.
- BR-01 dijaga oleh partial unique index + advisory lock. BR-12 dijaga oleh `SELECT FOR UPDATE`.
- Jika advisory lock tidak bisa diambil (`pg_try_advisory_xact_lock` return FALSE), operasi DITOLAK (fail closed).
- Setiap aksi dari klien membawa `client_action_id` (ULID) untuk idempotency. Dicek di `entry_logs.client_action_id UNIQUE`.
- Skema Zod di `packages/shared` harus identik dengan Drizzle schema. Jangan mengubah skema tanpa izin dan tanpa migration.
- Kolom baru ditambah lewat Drizzle migration file baru (append-only, tidak rename/drop).

## 6. Aturan Bisnis Inti (penegakan + deteksi)

- BR-01: satu shift non-void per (definisi shift + tanggal + is\_test) per cabang. Dijaga oleh partial unique index + advisory lock.
- BR-02: tanggal shift = tanggal saat dibuka (zona waktu cabang).
- BR-05: shift memakai snapshot template (JSONB); perubahan template tidak memengaruhi shift berjalan.
- BR-12: aksi pertama pada item diterima; yang kalah mendapat "sudah diselesaikan oleh X". Dijaga `SELECT FOR UPDATE`.
- BR-14: tidak ada "centang semua".
- BR-23: penentuan waktu memakai jam server terkoreksi, bukan jam HP.
- BR-30: tutup shift hanya oleh PJ, semua item wajib selesai/skip beralasan, handover terisi.
- Setelah ditutup, shift, checklist, handover, dan laporan tidak dapat diubah lewat API. Koreksi hanya lewat addendum.
- BR-40: API tidak menghapus baris.
- BR-41: isi incident tidak dapat diedit; koreksi lewat catatan tambahan.
- BR-43: audit log append-only dengan hash chain. Bersifat DETEKSI: verifikasi mingguan oleh cron, kerusakan dilaporkan ke admin.
- Aksi sensitif admin wajib alasan + konfirmasi PIN dan tercatat di audit log.
- Admin terakhir tidak boleh dinonaktifkan atau diturunkan.

## 7. Keamanan

- Otorisasi di server pada SETIAP request: peran + akses cabang. Jangan mengandalkan penyembunyian di UI.
- Jangan pernah menaruh rahasia (SUPABASE\_SERVICE\_ROLE\_KEY, SESSION\_SECRET, PIN\_PEPPER, GOOGLE\_SA\_PRIVATE\_KEY) di kode klien, log, atau respons.
- Jangan mencatat PIN atau pin\_hash di log atau audit.
- Cookie sesi: HttpOnly, Secure, SameSite=Lax. Pasang CSRF (custom header `X-Requested-With`) dan rate limiting.
- Validasi semua input di server dengan Zod.
- Pesan galat ke pengguna tidak membocorkan detail database/Google.
- Foto disajikan lewat route API `/api/photos/[id]` yang memeriksa akses cabang → Supabase signed URL, bukan tautan langsung ke Storage.

## 8. Gaya Kode

- TypeScript strict. Tanpa `any` tanpa alasan tertulis.
- Ikuti pola yang sudah ada di repo sebelum membuat pola baru.
- Fungsi kecil, tanpa abstraksi spekulatif.
- Komentar minimal; hanya untuk "mengapa", bukan "apa".
- Teks antarmuka Bahasa Indonesia, singkat dan lugas.
- UI: mobile-first, target sentuh minimal 48px, teks dasar 16px, status tidak hanya dengan warna (sertakan ikon + teks), gunakan komponen shadcn yang sudah ada sebelum membuat komponen baru.
- Drawer untuk modal di HP, Dialog di desktop.

## 9. Cara Bekerja

1. Baca dokumen yang relevan dengan tugas, ringkas pemahaman Anda dalam beberapa baris.
2. Sebutkan kontradiksi, informasi yang hilang, dan asumsi. Tanyakan jika ada keputusan terbuka (lihat bagian 11).
3. Usulkan rencana + daftar file. Tunggu persetujuan.
4. Implementasikan hanya yang disetujui.
5. Jalankan pemeriksaan relevan dari [TESTING.md](http://TESTING.md).
6. Laporkan: apa yang diubah, apa yang diuji, apa yang BELUM terverifikasi.

## 10. Pengujian dan Pelaporan

- Jangan menandai sesuatu lulus kecuali benar-benar dijalankan atau diverifikasi.
- Pisahkan: \[Otomatis\] dan \[Manual\] untuk pengguna.
- Uji konkurensi (BR-01, BR-12) dengan dua akun/permintaan paralel, bukan satu alur.
- Jika tes gagal, laporkan apa adanya (Tes, Diharapkan, Aktual, Langkah). Jangan melemahkan atau menghapus tes agar lulus.
- Jangan mengklaim "aman" tanpa menyebut apa yang diperiksa.

## 11. Keputusan Terbuka (JANGAN diputuskan sendiri, tanyakan)

- Apakah severity incident dipakai (kolom opsional sudah ada di schema).
- Target skala dan metrik keberhasilan numerik final (PRD §12).
- Apakah web push diimplementasikan di Fase awal atau belakangan.
- Akordeon vs tab untuk Kategori SOP; apakah admin memakai HP.

## 12. Perintah (terverifikasi Fase 0, npm workspaces)

- Install: `npm install` (root)
- Dev web: `npm run dev --workspace=apps/web` (default `:3000`)
- DB schema push (development): `npx drizzle-kit push`
- DB migration (production): `npx drizzle-kit migrate`
- Typecheck: `npx tsc --noEmit -p packages/shared/tsconfig.json`, `npx tsc --noEmit -p apps/web/tsconfig.json`
- Build: `npm run build --workspace=apps/web`

## 13. Saat Ragu

Tanyakan, jangan menebak. Lebih baik satu pertanyaan singkat daripada perubahan besar yang salah.

## 14. Lakukan commit dan push berkala.

