# Technical Requirements Document — checklist-shift (v2)

Acuan fungsional: `PRD.md`. Jika konflik, PRD.md berlaku untuk perilaku produk; dokumen ini berlaku untuk keputusan teknis.

> **Perubahan dari v1:** Stack disederhanakan. Google Sheets API, Redis/Upstash, Hono (apps/api terpisah), Dexie (offline queue), dan dua Vercel project **dihapus**. Digantikan oleh Supabase PostgreSQL, Next.js API Routes, dan Supabase Storage dengan arsip PDF ke Google Drive.

---

## 1. Ringkasan

PWA mobile-first (Bahasa Indonesia) untuk memastikan SOP tiap shift outlet F&B dijalankan dan terdokumentasi: checklist bersama, incident, handover, laporan shift terkunci. Dua peran: Petugas dan Admin. Target: 5–20 cabang, max 50 petugas serentak.

---

## 2. Tujuan Teknis

- Pengisian cepat dengan optimistic UI; sinkronisasi di latar belakang.
- Aturan "yang pertama diterima" (BR-12) dan satu shift per kunci (BR-01) ditegakkan di database, bukan dikoreksi belakangan.
- Riwayat tidak bisa diubah tanpa jejak: audit log append-only + hash chain.
- Menambah cabang tanpa mengubah kode.
- Semua komponen dapat di-deploy di Vercel (satu project).
- Stack sesederhana mungkin untuk skala 5–20 cabang.

---

## 3. Stack (Keputusan)

| Lapisan | Pilihan | Status |
|---|---|---|
| Frontend | Next.js 14+ (App Router) + TypeScript, Tailwind, shadcn/ui, Lucide | Putus |
| Backend | Next.js API Routes (built-in, monorepo gabung) | Putus |
| Framework backend terpisah | ~~Hono~~ — **dihapus** | Dihapus |
| Validasi | Zod, skema di `packages/shared` | Putus |
| Database | **Supabase PostgreSQL** | Putus |
| ORM | **Drizzle ORM** | Putus |
| Storage foto aktif | **Supabase Storage** (bucket `shift-photos`, foto ~7 hari) | Putus |
| Arsip foto | **Google Drive PDF** mingguan (service account) | Putus |
| Lock BR-01 & tutup shift | **PostgreSQL advisory lock** (`pg_try_advisory_xact_lock`) | Putus |
| Lock BR-12 | **`SELECT ... FOR UPDATE`** pada baris `entries` | Putus |
| Cache | ~~Redis~~ — **dihapus**, query Drizzle langsung (indexed) | Dihapus |
| Sesi | Tabel `sessions` di PostgreSQL + JWT cookie HttpOnly | Putus |
| Rate limit login | In-memory `Map` per process | Putus |
| PIN fail counter | Tabel `pin_fail_attempts` di PostgreSQL | Putus |
| Idempotency aksi | Kolom UNIQUE `client_action_id` di `entry_logs` | Putus |
| Hash PIN | argon2 + `PIN_PEPPER` | Putus |
| Offline/PWA | Serwist app shell cache only — ~~Dexie~~ **dihapus** | Putus |
| Push | web-push (VAPID) + pusat notifikasi berbasis DB | Asumsi |
| PDF | `@react-pdf/renderer` (server-side, Vercel Function) | Putus |
| Tema | Minimalist Corporate | Putus |
| Hosting | Vercel — **satu project** (bukan dua) | Putus |
| Drive | Service account — hanya untuk arsip PDF (bukan data) | Putus |

**Yang dihapus vs TRD v1:**

| Komponen v1 | Alasan dihapus | Pengganti |
|---|---|---|
| Google Sheets API | Terlalu kompleks untuk skala target | Supabase PostgreSQL |
| Upstash Redis | Tidak diperlukan untuk 50 concurrent | PostgreSQL advisory lock + in-memory |
| Hono (`apps/api`) | Overhead deployment terpisah | Next.js API Routes |
| Dexie + offline queue | Offline "nice to have", bukan wajib | Optimistic UI + retry |
| Vercel project kedua | Akibat Hono terpisah | Digabung ke satu project |
| Pool service account | Akibat kuota Sheets API | Tidak relevan (SQL tidak ada kuota) |
| Cache rowmap Redis | Sheets tidak punya index | SQL index handle ini |
| Tab bulanan `Entries_YYYY-MM` | Batas 10 juta sel Sheets | Tidak relevan di PostgreSQL |
| Rekonsiliasi edit manual Sheets | Pemilik bisa edit spreadsheet | Tidak relevan (DB di-control penuh) |

---

## 4. Arsitektur

```
Browser (PWA)
    |
    ↓ HTTPS (satu origin, /api/* → Next.js API Routes)
Next.js App Router + API Routes
    (Vercel — satu project)
    |           |              |
    ↓           ↓              ↓
Supabase    Supabase       Google Drive
PostgreSQL  Storage        (service account)
(data,      (foto aktif,   (arsip PDF mingguan)
 sessions,  <7 hari,
 audit log) <500MB)
    |
    ↓ Vercel Cron
Cron Jobs:
 - Arsip foto mingguan → PDF → Drive → purge Supabase
 - Summary harian
 - Cleanup tokens/sessions
 - Deteksi anomali
```

- Browser memanggil `/api/*` pada domain web Next.js. Tidak ada CORS, tidak ada masalah cookie SameSite lintas domain (iOS).
- Supabase PostgreSQL diakses dari server-side Next.js via Drizzle ORM menggunakan connection string. **Tidak ada akses langsung dari browser ke Supabase** (menggunakan service role key, bukan anon key).
- Foto diakses lewat route `/api/photos/[id]` yang memeriksa akses cabang lalu mengembalikan signed URL Supabase (TTL 1 jam).

---

## 5. Struktur Monorepo

```
apps/web/          Next.js (App Router, API Routes, Service Worker)
  app/             App Router pages + layouts
  app/api/         API Routes (auth, shifts, checklist, photos, cron, ...)
  lib/             Helpers: db, storage, drive, pdf, auth, lock, ...
  components/      UI components
  public/          Static assets, manifest.json
packages/shared/   Tipe TypeScript + Zod schemas (kontrak API ↔ UI)
  schema/          Zod schemas per entity (identik dengan Drizzle schema)
  types/           TypeScript types
drizzle/           Drizzle config + migration files
  schema.ts        Definisi semua tabel
  migrations/      SQL migration files
```

Tidak ada `apps/api` (Hono dihapus) dan tidak ada `apps/gas`.

---

## 6. Desain Data (Overview)

Detail lengkap ada di `DATABASE_SCHEMA.md`. Ringkasan:

- **Satu database PostgreSQL** untuk semua data. Cabang dibedakan via `branch_id` kolom (bukan per spreadsheet).
- ID: ULID 26 karakter (TEXT), dibuat di aplikasi.
- Waktu: TIMESTAMPTZ (UTC). Tampil sesuai timezone cabang.
- Enum: TEXT dengan CHECK constraint di PostgreSQL, divalidasi Zod di `packages/shared`.
- `template_snapshot`: JSONB di PostgreSQL — tidak perlu kompresi (PostgreSQL handle natively, batas praktis jauh di atas 50KB).
- Tidak ada tab bulanan — gunakan index pada `shift_date` / `reported_at`.
- Tabel besar (entries, entry_logs, incidents): diindex pada `shift_instance_id` dan `branch_id`.
- `summary` table: agregat harian diisi cron, dibaca dashboard/statistik.

---

## 7. Pola Akses Data

- Baca via Drizzle query (SELECT dengan index). Tidak perlu cache Redis karena PostgreSQL punya index yang efisien.
- Tulis selalu dalam transaction PostgreSQL untuk atomicity.
- Lock untuk operasi kritis: advisory lock atau `SELECT FOR UPDATE` (lihat bagian 8).
- Idempotency: cek `entry_logs.client_action_id UNIQUE` sebelum proses. Jika sudah ada, kembalikan hasil sebelumnya.
- Tidak ada rowmap cache — `WHERE id = $1` pada table dengan PK TEXT sudah efisien.

---

## 8. Konkurensi

### BR-01: Satu Shift Non-Void per (Definisi Shift + Tanggal + is_test)

```sql
-- Partial unique index (di schema):
CREATE UNIQUE INDEX uix_shift_br01
  ON shift_instances(shift_definition_id, shift_date, is_test)
  WHERE status != 'void';

-- Pola di kode:
-- 1. Ambil advisory lock per (branch, shift_def, date)
SELECT pg_try_advisory_xact_lock(hashtext('shift:' || branch_id || ':' || shift_def_id || ':' || date::text));
-- Jika false → lock tidak bisa diambil, kembalikan error
-- 2. Cek apakah sudah ada shift berjalan (lewat query)
-- 3. Jika belum ada: INSERT shift_instances (akan fail jika ada race condition lewat unique index)
-- 4. Jika sudah ada: kembalikan "bergabung"
-- Lock dilepas otomatis saat transaction selesai (advisory xact lock)
```

### BR-12: Pemenang Pertama pada Aksi Checklist

```sql
-- 1. Cek idempotency
SELECT id FROM entry_logs WHERE client_action_id = $1;
-- Jika ada, kembalikan hasil sebelumnya

-- 2. Row-level lock pada baris entries
SELECT id, state, completed_by
FROM entries
WHERE shift_instance_id = $1 AND point_ref = $2
FOR UPDATE;
-- Jika baris ada dan state sudah 'selesai'/'skip' oleh orang lain:
--   INSERT entry_logs dengan outcome='ditolak_kalah'
--   Kembalikan "sudah diselesaikan oleh X"
-- Jika menang:
--   INSERT/UPDATE entries
--   INSERT entry_logs dengan outcome='diterima'
```

### Tutup Shift

```sql
SELECT pg_try_advisory_xact_lock(hashtext('close:' || shift_instance_id));
-- Validasi BR-30 (item wajib, handover)
-- UPDATE shift_instances + INSERT reports dalam satu transaction
```

### Audit Log

- Tulis baris audit dalam **transaction yang sama** dengan perubahan data yang diaudit.
- Hash chain: `hash = SHA-256(prev_hash || '|' || canonicalJSON({...fields}))`
- `prev_hash` diambil dari baris audit terakhir sebelum INSERT (di dalam transaction, `FOR UPDATE`).

---

## 9. Autentikasi dan Keamanan

- **Login**: username + PIN 6 angka. `argon2.verify(pin_hash, input + PIN_PEPPER)`.
- **Rate limit login**: in-memory `Map<userId, {count, lockUntil}>` per process. Reset saat login berhasil. Persist ke tabel `pin_fail_attempts` untuk tracking.
- **Sesi**: JWT (HS256, `SESSION_SECRET`) di cookie `HttpOnly Secure SameSite=Lax`. Payload: `{userId, sessionId, exp}`. Pencabutan: cek `sessions.revoked_at IS NULL` dan `expires_at > now()`.
- **Logout semua perangkat**: `UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`.
- **Otorisasi**: middleware server-side setiap request. Cek peran + `user_branch_access.is_active` untuk akses cabang.
- **Aksi sensitif**: alasan + konfirmasi ulang PIN. Tidak ada PIN di log atau respons API.
- **CSRF**: SameSite=Lax + custom header `X-Requested-With` untuk state-changing requests.
- **Foto**: diakses lewat `/api/photos/[id]` (cek akses cabang → Supabase signed URL 1 jam). Tidak ada tautan langsung ke Supabase Storage bucket.
- **Secret**: `SESSION_SECRET`, `PIN_PEPPER`, `GOOGLE_SA_PRIVATE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — hanya di server, tidak pernah di bundel klien.

---

## 10. PWA & Offline

**Apa yang di-cache:**
- App shell (HTML, CSS, JS, font) via Serwist service worker
- Data baca (checklist aktif, report hari ini) via stale-while-revalidate

**Apa yang TIDAK ada (dihapus):**
- Dexie (IndexedDB queue)
- Offline write queue (centang, incident, handover)
- Sinkronisasi antrian

**Trade-off yang diterima:**
Offline "nice to have" untuk skala ini. Petugas yang kehilangan koneksi saat mengisi akan melihat pesan error yang jelas dan bisa retry manual. Optimistic UI membuat centang terasa instan; rollback otomatis jika request gagal.

**Apa yang wajib online:**
- Login awal, buka shift, tutup shift, aksi admin, buat tautan bagikan.

**Apa yang bisa offline (read-only):**
- Melihat checklist shift yang di-cache, melihat report yang di-cache.

---

## 11. Strategi Foto

### a. Kompresi WebP di Klien

```typescript
// Browser: Canvas API, target 100KB
async function compressToWebP(file: File, targetKB = 100): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 1920 / Math.max(img.width, img.height));
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  // Binary search quality
  let q = 0.8;
  let blob = await new Promise<Blob>(r => canvas.toBlob(b => r(b!), 'image/webp', q));
  for (let i = 0; i < 5 && blob.size > targetKB * 1024; i++) {
    q *= 0.75;
    blob = await new Promise<Blob>(r => canvas.toBlob(b => r(b!), 'image/webp', q));
  }
  return blob;
}
```

### b. Upload ke Supabase Storage

```
POST /api/photos/upload
→ verifikasi auth + akses cabang
→ upload ke Supabase Storage: shift-photos/{branch_id}/{shift_id}/{photo_id}.webp
→ INSERT photos (status='uploaded', file_ref=path)
→ return photo_id
```

### c. Akses Foto

```
GET /api/photos/[id]
→ verifikasi auth + akses cabang foto
→ supabase.storage.createSignedUrl(file_ref, 3600)
→ redirect ke signed URL
```

### d. Arsip Mingguan (Cron Senin 02.00 WIB)

```
1. Query: shift_instances yang closed > 7 hari, punya photos status='uploaded'
2. Per shift:
   a. Fetch semua data shift + entries + handover + incidents + photos
   b. Download foto dari Supabase Storage (via service role key)
   c. Generate PDF dengan @react-pdf/renderer (embed foto sebagai base64)
   d. Upload PDF ke Google Drive:
      Folder: checklist-shift-archive/{branch_code}/
      Nama: {branch_name}-{shift_date}-{shift_name}-{branch_id}-{ulid}.pdf
   e. UPDATE reports SET archive_pdf_drive_id, archive_pdf_drive_url, archived_at, archived_photo_count
   f. DELETE dari Supabase Storage (batch per shift)
   g. UPDATE photos SET status='purged', purged_at=now()
3. Semua dalam transaction DB; jika gagal di tengah → retry saat cron berikutnya
```

### e. Tampilan Setelah Purged

Di laporan shift, foto yang sudah diarsip tampil sebagai:
```
[ 🗄️  Foto telah diarsip ]  [ Lihat PDF Arsip ↗ ]
```
Link mengarah ke `reports.archive_pdf_drive_url`.

### f. Estimasi Kapasitas

| Kondisi | Foto di Supabase |
|---|---|
| Arsip mingguan | Foto ≤ 7 hari terakhir |
| 20 cabang × 3 shift × 5 foto × 100KB | ~30MB/hari × 7 hari = ~210MB puncak |
| Threshold darurat 80% (400MB) | Trigger arsip lebih awal |
| **Kondisi normal** | **~100–200MB, aman** ✅ |

---

## 12. Pekerjaan Terjadwal (Vercel Cron)

Semua endpoint cron dilindungi header `Authorization: Bearer {CRON_SECRET}`.

| Cron | Jadwal | Tugas |
|---|---|---|
| `archive-photos` | Setiap Senin 02.00 WIB (`0 19 * * 0` UTC) | Generate PDF per shift tua → Drive → purge Supabase |
| `storage-threshold` | Setiap hari 00.00 UTC | Cek usage Supabase Storage; jika >400MB → arsip darurat shift paling lama |
| `daily-summary` | Setiap hari 01.00 UTC | Hitung agregat `summary` table per cabang |
| `detect-anomali` | Setiap hari 01.30 UTC | Deteksi shift tidak ditutup melewati jam selesai; kirim notifikasi admin |
| `cleanup` | Setiap Senin 03.00 UTC | Hapus `share_tokens` & `sessions` kedaluwarsa; cleanup foto `pending` >24 jam |
| `verify-hash-chain` | Setiap Minggu | Verifikasi hash chain audit log; notifikasi admin jika rusak |

---

## 13. Environment Variables

| Variabel | Fungsi |
|---|---|
| `SUPABASE_URL` | URL project Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server only, JANGAN expose ke klien) |
| `NEXT_PUBLIC_SUPABASE_URL` | URL untuk Supabase Storage signed URL (klien boleh tahu) |
| `DATABASE_URL` | PostgreSQL connection string (Drizzle) |
| `SESSION_SECRET` | Tanda tangan JWT sesi |
| `PIN_PEPPER` | Pengaman tambahan hash PIN |
| `GOOGLE_SA_EMAIL` | Email service account Google |
| `GOOGLE_SA_PRIVATE_KEY` | Private key SA (ganti `\n` saat dibaca) |
| `GOOGLE_DRIVE_ARCHIVE_FOLDER_ID` | ID folder root arsip di Drive |
| `VAPID_PUBLIC_KEY` | Web push VAPID public key |
| `VAPID_PRIVATE_KEY` | Web push VAPID private key |
| `CRON_SECRET` | Proteksi endpoint cron |

**Tidak ada:**
- `REGISTRY_SPREADSHEET_ID` (Sheets dihapus)
- `UPSTASH_REDIS_REST_URL` / `TOKEN` (Redis dihapus)
- `BLOB_READ_WRITE_TOKEN` (Vercel Blob tidak dipakai)
- `API_BASE` / `API_PORT` (tidak ada project api terpisah)

---

## 14. Prosedur Tambah Cabang

1. Admin membuka halaman Cabang di admin UI.
2. Isi form: nama, kode, alamat, timezone.
3. Simpan → API INSERT ke tabel `branches`.
4. Selesai. Tidak perlu copy spreadsheet, tidak perlu setup file Drive.

*(Folder arsip Drive dibuat otomatis saat cron arsip pertama kali berjalan untuk cabang tersebut.)*

---

## 15. Persyaratan Non-Fungsional

- Responsif mulai 320px; target sentuh minimal 48px; teks dasar 16px; kontras memadai.
- Centang terasa instan (optimistic update); sinkronisasi di latar belakang.
- Skeleton untuk loading; pesan galat jelas dan dapat ditindaklanjuti.
- Supabase connection pool default: 60 connections. Untuk 50 petugas serentak, ini cukup (setiap request tidak hold connection lama).
- Backup: Supabase built-in daily backup (free tier: 1 hari PITR) + manual pg_dump mingguan.
- Migrasi skema: Drizzle migration files (`drizzle/migrations/`), idempoten, dijalankan satu kali untuk seluruh DB.

---

## 16. Batasan dan Risiko

| Risiko | Mitigasi |
|---|---|
| Supabase Storage 500MB | Cron arsip mingguan + threshold darurat 80% |
| PDF generation timeout (Vercel Function 10s) | Limit embed foto ke max 5 per item × max 10 item = 50 foto per PDF; jika lebih besar, split per bagian |
| Drive API quota upload | Arsip mingguan (bukan harian), retry exponential backoff |
| In-memory rate limit hilang saat restart | Trade-off yang diterima; persist ke `pin_fail_attempts` untuk tracking, in-memory untuk kecepatan |
| Supabase connection pool | Monitor via Supabase dashboard; untuk >50 concurrent, upgrade ke pgBouncer |
| Advisory lock timeout | TTL advisory xact lock = durasi transaction (~1–2 detik); queue natural di PostgreSQL |

---

## 17. Keputusan Terbuka

1. Apakah severity incident dipakai? (kolom opsional sudah ada di schema)
2. Target metrik keberhasilan numerik final (PRD §12).
3. Apakah web push diimplementasikan di Fase awal atau belakangan?

---

## 18. Definition of Done

- Alur kritis petugas (buka → checklist → handover → tutup → laporan → bagikan) berjalan end to end.
- BR-01 dan BR-12 lolos uji dua pengguna bersamaan.
- Tidak ada rahasia di kode klien; otorisasi per cabang diuji.
- Foto terkompresi WebP <150KB, diarsip ke Drive, dihapus dari Supabase otomatis.
- Semua fitur PRD (13 modul admin) tersedia.
- Deploy produksi di Vercel berhasil dan TESTING.md lulus.
