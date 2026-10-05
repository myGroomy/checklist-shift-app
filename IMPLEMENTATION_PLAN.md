# Implementation Plan — checklist-shift v2

> **Stack baru (lihat TRD.md v2):** Next.js fullstack + Supabase PostgreSQL + Drizzle ORM + Supabase Storage + Google Drive PDF archive. Redis, Hono, Google Sheets API, Dexie, offline queue, dan Vercel project kedua **dihapus**.

## Aturan Kerja

- Kerjakan satu fase pada satu waktu. Jangan mulai fase berikutnya sebelum verifikasi fase ini lulus.
- Tidak ada pembagian MVP: seluruh fitur PRD dibangun, urutan di bawah hanya ketergantungan teknis.
- Sebelum coding tiap fase: daftar asumsi dan file yang akan dibuat/diubah.
- Ubah dokumen (TRD/DATABASE\_SCHEMA/APP\_FLOW) bila keputusan berubah.

---

## Fase 0 — Setup Project &amp; Infrastruktur — **[BELUM]**

Tugas:

- [ ] `[FRONTEND|BACKEND]` Inisialisasi Next.js 14+ (App Router, TypeScript strict, Tailwind, shadcn/ui, Lucide).
- [ ] `[BACKEND]` Setup `packages/shared`: TypeScript, Zod schemas awal, shared types.
- [ ] `[DATABASE]` Supabase project baru: aktifkan PostgreSQL, buat Storage bucket `shift-photos` (private).
- [ ] `[DATABASE]` Drizzle ORM setup: `drizzle.config.ts`, connection string dari Supabase.
- [ ] `[DATABASE]` Drizzle schema awal (semua tabel sesuai DATABASE\_SCHEMA.md), push ke Supabase.
- [ ] `[DATABASE]` Seed `settings` default ke tabel settings.
- [ ] `[BACKEND]` Google Drive service account: buat SA di Google Cloud Console, simpan credential, buat folder root `checklist-shift-archive/` di Drive, bagikan ke SA sebagai Editor.
- [ ] `[BACKEND]` File `.env.example` lengkap (semua variabel dari TRD.md §13).
- [ ] `[FRONTEND|BACKEND]` Vercel project (satu), link ke repo, set env vars di Vercel dashboard.
- [ ] `[BACKEND]` Health check endpoint: `GET /api/health` → return `{db: 'ok', storage: 'ok', timestamp}`.

Hasil: Next.js jalan lokal dan terdeploy; `GET /api/health` return 200; Drizzle terhubung ke Supabase.

Verifikasi:

- [ ] `[API]` `GET /api/health` return 200 dengan `db: ok` dan `storage: ok`.
- [ ] `[DATABASE]` `npx drizzle-kit push` berhasil, semua tabel ada di Supabase.
- [ ] `[FRONTEND]` Build sukses di Vercel tanpa error TypeScript.

---

## Fase 1 — Data Layer (Drizzle + Repository) — **[BELUM]**

Tugas:

- [ ] `[DATABASE]` Drizzle schema lengkap: semua tabel, index, CHECK constraints sesuai DATABASE\_SCHEMA.md.
- [ ] `[DATABASE]` Migration file awal: `drizzle/migrations/0001_initial.sql`.
- [ ] `[BACKEND]` Repository layer: typed Drizzle queries per entitas utama (branches, users, shift\_instances, entries, incidents, reports, photos, audit\_log).
- [ ] `[BACKEND]` Advisory lock helper: `acquireAdvisoryLock(db, key: string): Promise<boolean>` menggunakan `pg_try_advisory_xact_lock(hashtext($key))`.
- [ ] `[BACKEND]` Transaction helper: `withTransaction(db, fn)` — wrapper `db.transaction(fn)`.
- [ ] `[BACKEND]` Audit log helper: `appendAuditLog({db, actor_id, action, ...})` — ambil prev\_hash dari baris terakhir, hitung hash, INSERT dalam transaction yang sama.
- [ ] `[BACKEND]` Hash chain verifier: `verifyAuditChain(db, branch_id?)` — baca semua baris, verifikasi hash.
- [ ] `[BACKEND]` Supabase Storage helper: `uploadFile(path, buffer)`, `getSignedUrl(path, ttlSeconds)`, `deleteFile(path)`.
- [ ] `[BACKEND]` Google Drive helper: `uploadFileToDrive(folderId, name, buffer, mimeType)` menggunakan service account credential.
- [ ] `[BACKEND]` Server time helper (BR-23): `getServerTime()` — return `new Date()` server, bukan jam klien.
- [ ] `[BACKEND]` Idempotency check: `checkIdempotency(db, client_action_id)` — cek `entry_logs.client_action_id`.
- [ ] `[BACKEND]` Snapshot builder: `buildTemplateSnapshot(db, shift_definition_id, date, timezone)` — query checklist\_points + handover\_fields aktif untuk hari tertentu.
- [ ] `[BACKEND]` Zod schemas di `packages/shared` identik dengan Drizzle schema (tipe + enum).

Hasil: semua helper teruji unit; query dasar berjalan ke Supabase.

Verifikasi:

- [ ] `[DATABASE]` Semua tabel ada, index terbuat, partial unique index BR-01 berfungsi.
- [ ] `[BACKEND]` Advisory lock: dua panggilan bersamaan → satu dapat `true`, satu `false`.
- [ ] `[BACKEND]` Hash chain: edit manual satu baris audit → `verifyAuditChain` return mismatch.
- [ ] `[BACKEND]` Upload ke Supabase Storage berhasil; `getSignedUrl` bisa diakses browser.
- [ ] `[BACKEND]` Zod parse data dari DB tidak error untuk semua tabel.

---

## Fase 2 — Autentikasi &amp; Akses — **[BELUM]**

Tugas:

- [ ] `[BACKEND]` Login: `POST /api/auth/login` — cari user by username, `argon2.verify(pin_hash, input + PIN_PEPPER)`, cek `is_active`, cek `locked_until`, cek `must_change_pin`.
- [ ] `[BACKEND]` Rate limit login: increment `pin_fail_attempts.count`, lock jika `>= pin_max_attempts` (set `users.locked_until`), reset saat sukses.
- [ ] `[BACKEND]` Sesi: buat baris `sessions`, generate JWT HS256 (`{userId, sessionId, exp}`), set cookie `HttpOnly Secure SameSite=Lax`.
- [ ] `[BACKEND]` Middleware auth: `withAuth(handler)` — verify JWT, cek `sessions.revoked_at IS NULL` dan `expires_at > NOW()`, cek `users.is_active`, inject `user` ke request context.
- [ ] `[BACKEND]` Middleware otorisasi peran: `requireRole('admin')` / `requireBranchAccess(branch_id)`.
- [ ] `[BACKEND]` Ganti PIN: `POST /api/auth/change-pin` — verify PIN lama, validasi PIN baru (6 angka, block weak jika `pin_block_weak=TRUE`), argon2 hash + pepper, update `pin_hash`, `must_change_pin=FALSE`, `pin_changed_at`.
- [ ] `[BACKEND]` Logout: `POST /api/auth/logout` — set `sessions.revoked_at = NOW()`, clear cookie.
- [ ] `[BACKEND]` Logout semua perangkat: `POST /api/auth/logout-all` — revoke semua sessions aktif user.
- [ ] `[BACKEND]` Paksa logout (admin): revoke semua sessions user target.
- [ ] `[BACKEND]` Audit log: login berhasil, ganti PIN, logout.
- [ ] `[FRONTEND]` Login screen: username input + PIN keypad numerik 6 angka (Input OTP shadcn).
- [ ] `[FRONTEND]` Middleware Next.js: redirect ke `/login` jika tidak ada sesi; redirect ke `/ganti-pin` jika `must_change_pin=TRUE`.
- [ ] `[FRONTEND]` Halaman `/ganti-pin`: form PIN lama + PIN baru + konfirmasi, tidak bisa dilewati.
- [ ] `[BACKEND]` CSRF: custom header `X-Requested-With: fetch` pada semua state-changing request.

Hasil: login/logout aman; rute dilindungi; ganti PIN wajib di login pertama.

Verifikasi:

- [ ] `[API]` 5 PIN salah mengunci akun; hitung mundur tampil; admin buka kunci → login bisa lagi.
- [ ] `[API]` Sesi dicabut langsung setelah logout; JWT lama ditolak.
- [ ] `[API]` Petugas tidak dapat memanggil endpoint admin (403).
- [ ] `[API]` Petugas tidak dapat akses cabang di luar izinnya (403).
- [ ] `[API]` Akun nonaktif kehilangan sesi.
- [ ] `[FRONTEND]` Login pertama → redirect ke `/ganti-pin` → tidak bisa ke halaman lain sebelum ganti PIN.

---

## Fase 3 — Konfigurasi Admin — **[3a BELUM, 3b BELUM, 3c BELUM]**

### 3a — Registry Admin — **[BELUM]**

- [ ] `[API|BACKEND]` CRUD Branches: buat, ubah, nonaktifkan. Validasi timezone IANA.
- [ ] `[API|BACKEND]` CRUD Users: buat (nama, username, PIN awal, peran, akses cabang), ubah nama/peran/akses, nonaktifkan/aktifkan.
- [ ] `[API|BACKEND]` Perlindungan admin terakhir: tolak nonaktifkan/turunkan peran jika hanya satu admin aktif.
- [ ] `[API|BACKEND]` Reset PIN user: admin generate PIN baru, set `must_change_pin=TRUE`.
- [ ] `[API|BACKEND]` Buka kunci akun: reset `locked_until = NULL`, reset `pin_fail_attempts.count = 0`.
- [ ] `[API|BACKEND]` Paksa logout user: revoke semua sessions target.
- [ ] `[API|BACKEND]` CRUD IncidentCategories: tambah, ubah, nonaktifkan.
- [ ] `[API|BACKEND]` CRUD Settings: baca semua, update per key dengan validasi value\_type.
- [ ] `[API|BACKEND]` Audit Log: `GET /api/admin/audit-log` dengan filter `actor_id`, `action`, `branch_id`, `from`, `to`; paginasi cursor-based.
- [ ] `[FRONTEND]` Komponen aksi sensitif (reusable): ringkasan dampak + input alasan wajib + konfirmasi PIN. Dipakai: reset PIN, ubah peran/akses, nonaktifkan akun, tutup paksa, ganti PJ, void, buka kunci laporan.
- [ ] `[FRONTEND]` Admin shell: sidebar 13 modul (desktop), Sheet geser (HP), topbar (avatar, mode pratinjau).
- [ ] `[FRONTEND]` Halaman Cabang: tabel + form + nonaktifkan.
- [ ] `[FRONTEND]` Halaman Akun: tabel + form multi-select cabang + aksi sensitif (reset PIN, buka kunci, paksa logout, nonaktifkan).
- [ ] `[FRONTEND]` Halaman Kategori Incident: tabel dengan edit inline.
- [ ] `[FRONTEND]` Halaman Pengaturan: form berkelompok (waktu/toleransi, PIN/sesi, foto, WhatsApp template dengan pratinjau variabel).
- [ ] `[FRONTEND]` Halaman Audit Log: tabel read-only, filter, ekspansi before/after.

### 3b — Konfigurasi Shift per Cabang — **[BELUM]**

- [ ] `[API|BACKEND]` CRUD ShiftDefinitions per cabang (nama, jam, crosses\_midnight, urutan, aktif/nonaktif).
- [ ] `[API|BACKEND]` CRUD SopCategories per shift (nama, urutan, aktif/nonaktif).
- [ ] `[API|BACKEND]` CRUD ChecklistPoints: semua properti (tipe input, wajib, target\_time, tolerance, active\_days, number\_min/max, urutan, aktif/nonaktif).
- [ ] `[API|BACKEND]` CRUD HandoverFields per shift (label, field\_type, options, wajib, urutan).
- [ ] `[API|BACKEND]` Salin template dari cabang lain (`POST /api/admin/branches/[id]/copy-from/[source_id]`): duplikasi shift\_definitions + sop\_categories + checklist\_points + handover\_fields dengan ID baru.
- [ ] `[BACKEND]` Semua perubahan template tercatat di audit log dengan before/after.
- [ ] `[FRONTEND]` Halaman Shift &amp; Checklist Builder: tiga panel desktop (Branch+Shift selector / pohon Kategori+Point / editor), navigasi bertingkat di HP, drag &amp; drop sort\_order.
- [ ] `[FRONTEND]` Halaman Handover Builder: daftar field drag &amp; drop + editor.
- [ ] `[FRONTEND]` Konfirmasi perubahan template: "Berlaku untuk shift yang dibuka setelah ini".

### 3c — Duplikasi &amp; Pratinjau — **[BELUM]**

- [ ] `[API|BACKEND]` Duplikasi shift definition dalam cabang (beserta kategori dan point).
- [ ] `[API|BACKEND]` Duplikasi sop\_category dalam shift (beserta point).
- [ ] `[API|BACKEND]` Duplikasi checklist\_point.
- [ ] `[FRONTEND]` Pratinjau checklist sebagai petugas (read-only, dari template aktif).

Hasil: admin dapat menyiapkan cabang lengkap.

Verifikasi:

- [ ] Tambah cabang → buat shift → kategori → checklist point end-to-end, tidak ada error.
- [ ] Salin dari cabang lain: semua template terduplikasi dengan ID baru.
- [ ] Perubahan template tercatat di audit log dengan before/after.
- [ ] Admin terakhir tidak bisa dinonaktifkan (ditolak 400).

---

## Fase 4 — Siklus Shift &amp; Checklist Bersama — **[BELUM]**

Tugas:

- [ ] `[API|BACKEND|DATABASE]` Buka shift: advisory lock BR-01 → cek partial unique index → bangun `template_snapshot` JSONB → INSERT `shift_instances` + `participants` (PJ) + audit log. Jika sudah ada: return `{status: 'bergabung', shift_instance_id}`.
- [ ] `[API|BACKEND]` Gabung shift: `POST /api/shifts/[id]/join` — cek akses cabang, tambah participant jika belum ada.
- [ ] `[API|BACKEND]` "Saya bertugas": tambah participant dengan `first_action_type='saya_bertugas'`.
- [ ] `[API|BACKEND]` Aksi checklist (`POST /api/shifts/[id]/entries`): cek idempotency → validasi shift berjalan → `SELECT FOR UPDATE` entries → proses BR-12 → UPSERT entries + INSERT entry\_logs + upsert participants (satu transaction).
- [ ] `[API|BACKEND]` Semua tipe input: centang, foto, teks, angka (cek rentang), ok\_tidak\_ok.
- [ ] `[API|BACKEND]` Label waktu: hitung `timing_label` dan `timing_delta_minutes` berdasarkan `getServerTime()` vs `target_time` di snapshot (BR-23).
- [ ] `[API|BACKEND]` Item hanya muncul jika berlaku hari itu (filter `active_days` dari snapshot).
- [ ] `[API|BACKEND]` Skip item: `state='skip'`, `skip_reason` wajib.
- [ ] `[API|BACKEND]` Batal centang: `state='belum'`, log `action='batal'` di entry\_logs.
- [ ] `[API|BACKEND]` Buka shift atas nama (admin): `POST /api/admin/shifts/open-on-behalf`.
- [ ] `[API|BACKEND]` Ganti PJ (admin): `POST /api/admin/shifts/[id]/change-pj` — alasan wajib + PIN + audit log.
- [ ] `[API|BACKEND]` Polling progress: `GET /api/shifts/[id]/progress` — return semua entries + participants.
- [ ] `[FRONTEND]` Home: kartu shift aktif (nama, PJ, progress x/y), tombol Buka/Gabung/Lanjutkan/Tutup Shift.
- [ ] `[FRONTEND]` Home: tugas berikutnya (waktu target terdekat), daftar singkat incident open, grid shortcut 2x2 (Buat Incident, Checklist, Laporan Hari Ini, Handover Terakhir).
- [ ] `[FRONTEND]` Tab Checklist: daftar shift cabang (Belum dibuka/Berjalan/Ditutup); peringatan lunak jam tidak cocok.
- [ ] `[FRONTEND]` Checklist aktif: akordeon per Kategori SOP, progress per kategori, item dengan semua tipe input, label waktu, inisial pengisi + jam.
- [ ] `[FRONTEND]` Checklist aktif: tawaran buat incident setelah skip (IN-08), daftar peserta shift terlihat (nama, jumlah item).
- [ ] `[FRONTEND]` Upload foto: kompres WebP di klien (Canvas API, target 100KB) → `POST /api/photos/upload` → indikator upload per foto.
- [ ] `[FRONTEND]` Benturan BR-12: toast "sudah diselesaikan oleh X", tampilan diperbarui.
- [ ] `[FRONTEND]` Polling progress setiap 15–30 detik + saat app dibuka kembali.
- [ ] `[FRONTEND]` Optimistic update untuk centang (tampil selesai dulu, rollback jika error).

Hasil: beberapa petugas mengerjakan satu checklist bersama.

Verifikasi:

- [ ] `[API]` Dua akun Buka Shift bersamaan pada shift yang sama: satu jadi PJ, satu bergabung.
- [ ] `[API]` Dua akun centang item sama bersamaan: satu diterima, satu "sudah diselesaikan oleh X".
- [ ] `[BACKEND]` Label tepat\_waktu/lebih\_awal/terlambat benar di batas ±15 menit.
- [ ] `[FRONTEND]` Foto di HP terkompresi &lt;150KB sebelum dikirim ke server.
- [ ] `[API]` Item dengan active\_days='1,3,5' tidak muncul di hari Selasa.

---

## Fase 5 — Handover, Incident, Penutupan Shift — **[BELUM]**

Tugas:

- [ ] `[API|BACKEND|FRONTEND]` Baca handover shift sebelumnya: `GET /api/shifts/[id]/handover-prev` — query `shift_instances` terakhir berstatus ditutup/ditutup\_paksa di cabang.
- [ ] `[API|BACKEND]` Tandai handover sudah dibaca: `POST /api/handovers/[id]/ack` — INSERT `handover_acks`.
- [ ] `[API|BACKEND|FRONTEND]` Submit handover: `POST /api/shifts/[id]/handover` — validasi field wajib, INSERT `handovers`.
- [ ] `[API|BACKEND|FRONTEND]` Incident — buat: `POST /api/incidents` — tentukan `shift_instance_id` (berjalan atau 4 jam setelah closed), INSERT `incidents` + audit log.
- [ ] `[API|BACKEND|FRONTEND]` Buat incident dari item checklist yang di-skip/gagal (IN-08): data terisi otomatis dari item.
- [ ] `[API|BACKEND]` Foto incident: upload ke Supabase Storage via `/api/photos/upload`, max 5 foto.
- [ ] `[API|BACKEND]` Catatan lanjutan incident: `POST /api/incidents/[id]/notes` — INSERT `incident_notes`.
- [ ] `[FRONTEND]` Form incident: chip kategori → deskripsi → foto (maks 5) → waktu kejadian → Kirim.
- [ ] `[FRONTEND]` Detail incident: isi asli (read-only), foto, timeline catatan, tambah catatan.
- [ ] `[API|BACKEND|FRONTEND]` Stepper Tutup Shift (3 langkah):
  - Langkah 1 (Validasi): daftar item wajib belum selesai; tombol lanjut nonaktif sampai semua selesai/skip.
  - Langkah 2 (Handover): form field terstruktur + teks bebas + foto + toggle "Tidak ada incident" (BR-33).
  - Langkah 3 (Konfirmasi): ringkasan + input PIN → `POST /api/shifts/[id]/close`.
- [ ] `[BACKEND]` Tutup shift: advisory lock `close:{shiftId}` → validasi status=berjalan, pemanggil=PJ, BR-30 → hitung report\_number + content\_hash → UPDATE shift\_instances + INSERT reports + audit log (satu transaction).
- [ ] `[FRONTEND]` Layar sukses setelah tutup: tombol "Lihat Laporan" + "Bagikan WhatsApp".
- [ ] `[BACKEND]` Route foto: `GET /api/photos/[id]` — cek auth + akses cabang → Supabase signed URL 1 jam → redirect.

Hasil: shift dapat ditutup; laporan terkunci terbentuk.

Verifikasi:

- [ ] `[API]` Tutup ditolak jika ada item wajib belum selesai/skip.
- [ ] `[API]` Tutup ditolak jika handover field wajib kosong.
- [ ] `[API]` Hanya PJ yang bisa tutup (petugas lain → 403).
- [ ] `[API]` Setelah ditutup, semua tulis ke shift/entries/handover ditolak.
- [ ] `[API]` Foto ke-6 pada incident ditolak (max 5).
- [ ] `[FRONTEND]` PIN salah saat konfirmasi tutup shift: pesan jelas, handover tidak hilang.

---

## Fase 6 — Laporan, Berbagi, Operasi Admin — **[BELUM]**

Tugas:

- [ ] `[FRONTEND|BACKEND]` Tab Report: navigator tanggal + pemilih cabang + filter shift/rentang.
- [ ] `[FRONTEND]` Dua kartu ringkasan (Checklist, Incident); toggle ke daftar; desktop dua kolom.
- [ ] `[FRONTEND]` Detail laporan (RP-05): header, akordeon per Kategori SOP + label waktu + foto, skip + alasan, incident, handover, kontribusi per petugas (netral, bukan peringkat), addendum.
- [ ] `[FRONTEND|BACKEND]` Bagikan ke WhatsApp: `wa.me` dengan template dari settings, ringkasan + link laporan.
- [ ] `[API|BACKEND]` Share token: `POST /api/admin/reports/[id]/share` → generate token → INSERT `share_tokens`. `DELETE /api/admin/reports/[id]/share/[tokenId]` → revoke.
- [ ] `[FRONTEND]` Halaman publik `/r/[token]` — tanpa login, read-only, siap cetak. Kedaluwarsa/dicabut → halaman informasi.
- [ ] `[API|BACKEND]` Operasi admin shift: tutup paksa (BR-34), ganti PJ, void, buka atas nama — semua wajib alasan + PIN + audit log.
- [ ] `[API|BACKEND]` Addendum laporan: `POST /api/admin/reports/[id]/addenda` — INSERT `addenda` + audit log.
- [ ] `[API|BACKEND]` Buka kunci laporan (darurat): alasan + PIN + audit log + increment `unlock_count`.
- [ ] `[API|BACKEND]` Incident admin: ubah status, tambah catatan admin, tautkan ke shift.
- [ ] `[FRONTEND]` Halaman Operasi Shift admin: daftar shift berjalan lintas cabang; menu aksi.
- [ ] `[FRONTEND]` Halaman Incident admin: tabel + filter; ubah status, catatan, tautkan.
- [ ] `[FRONTEND]` Halaman Laporan admin (tab Daftar): filter lintas cabang, tombol addendum, buka kunci, share.

Hasil: laporan bisa dilihat, dibagikan, dikoreksi lewat addendum.

Verifikasi:

- [ ] `[FRONTEND]` Token kedaluwarsa/dicabut → halaman informasi (bukan 500).
- [ ] `[API]` Buka kunci wajib alasan + PIN, `unlock_count` naik, tercatat di audit log.
- [ ] `[API]` Void dikecualikan dari statistik.
- [ ] `[API]` Tutup paksa: laporan ditandai, item wajib belum selesai ditandai `is_incomplete`.

---

## Fase 7 — PWA (App Shell, Tanpa Offline Queue) — **[BELUM]**

> **Catatan:** Offline queue (Dexie) dihapus dari scope. Trade-off yang diterima untuk skala 5–20 cabang di area dengan koneksi cukup. Offline = read-only dari cache.

Tugas:

- [ ] `[FRONTEND]` Web app manifest: nama, ikon (semua ukuran), `display: standalone`, `theme_color`.
- [ ] `[FRONTEND]` Serwist service worker: cache app shell (HTML, CSS, JS, font, ikon).
- [ ] `[FRONTEND]` Cache strategi data baca: stale-while-revalidate untuk checklist aktif + report hari ini.
- [ ] `[FRONTEND]` Ajakan pasang PWA (install prompt): banner/drawer pada kunjungan kedua.
- [ ] `[FRONTEND]` Optimistic update untuk centang item: tampil selesai dulu, rollback otomatis jika request gagal.
- [ ] `[FRONTEND]` Indikator koneksi: banner "Tidak ada koneksi" saat offline.
- [ ] `[FRONTEND]` Pesan jelas untuk aksi online-only (buka shift, tutup shift, aksi admin): disabled + tooltip "Perlu koneksi internet".
- [ ] `[FRONTEND]` Safe-area iOS (env var `safe-area-inset-*` di Tailwind/CSS).
- [ ] `[FRONTEND]` Panduan pasang PWA di halaman Akun (screenshot langkah-langkah untuk iOS dan Android).
- [ ] `[FRONTEND]` Sesi habis saat offline: dialog informatif saat kembali online.

Hasil: app bisa dipasang di HP layar utama; pengalaman native; centang terasa instan.

Verifikasi:

- [ ] `[Manual]` Install PWA di iPhone (Safari) dan Android (Chrome); app muncul di layar utama.
- [ ] `[Manual]` Centang item → tampil selesai instan; jika koneksi gagal → kembali ke belum dengan pesan.
- [ ] `[Manual]` Banner offline muncul; aksi wajib online tampil disabled dengan tooltip.
- [ ] `[Manual]` Safe-area iOS tidak terpotong di bawah.

---

## Fase 8 — Notifikasi, Statistik, Arsip Foto, Dashboard — **[BELUM]**

Tugas:

- [ ] `[FRONTEND|BACKEND]` Pusat notifikasi dalam app: `GET /api/notifications` → list; `POST /api/notifications/[id]/read` → mark read. Simpan di tabel `notifications`. Jenis: handover\_baru, pengingat\_item, ganti\_pj, tutup\_paksa, shift\_tidak\_ditutup, shift\_tidak\_dibuka, incident\_baru, shift\_ditutup, aksi\_darurat.
- [ ] `[BACKEND]` Web push: setup VAPID, `POST /api/push/subscribe` → INSERT `push_subscriptions`, helper `sendPush(user_id, payload)`.
- [ ] `[FRONTEND]` Preferensi notifikasi di halaman Akun: toggle per jenis.
- [ ] `[BACKEND]` **Cron harian `daily-summary`** (`0 18 * * *` UTC = 01.00 WIB): hitung agregat per (branch, date, shift\_def) → UPSERT `summary`. is\_test dikecualikan.
- [ ] `[BACKEND]` **Cron harian `detect-anomali`** (`30 18 * * *` UTC = 01.30 WIB): deteksi shift berjalan melewati `end_time` tanpa ditutup → kirim notifikasi admin.
- [ ] `[BACKEND]` **Cron mingguan `archive-photos`** (`0 19 * * 0` UTC = Senin 02.00 WIB):
  - Query shift closed &gt;7 hari dengan foto `status='uploaded'`
  - Per shift: generate PDF (@react-pdf/renderer, embed foto sebagai base64 dari Supabase signed URL)
  - Upload PDF ke Drive: folder `checklist-shift-archive/{branch.code}/`, nama `{branch.name}-{shift_date}-{shift.name}-{branch.id}-{ulid}.pdf`
  - UPDATE `reports.archive_pdf_drive_id`, `archive_pdf_drive_url`, `archived_at`, `archived_photo_count`
  - UPDATE `photos SET status='purged', purged_at=NOW()` WHERE shift\_instance\_id dan status='uploaded'
  - DELETE dari Supabase Storage (batch per shift)
- [ ] `[BACKEND]` **Cron threshold `storage-threshold`** (`0 17 * * *` UTC = 00.00 WIB): cek Supabase Storage usage via API; jika &gt;80% (400MB) → jalankan arsip darurat untuk shift-shift paling tua yang belum diarsip.
- [ ] `[BACKEND]` **Cron mingguan `cleanup`** (`0 20 * * 0` UTC = Senin 03.00 WIB): hapus `share_tokens` kedaluwarsa + `sessions` kedaluwarsa; hapus `photos` status='pending' &gt;24 jam (upload gagal) dari Supabase Storage.
- [ ] `[BACKEND]` **Cron mingguan `verify-hash-chain`** (`0 21 * * 0` UTC = Senin 04.00 WIB): verifikasi hash chain audit log; jika ada mismatch → INSERT notifikasi admin `aksi_darurat`.
- [ ] `[FRONTEND|BACKEND]` Dashboard admin: kartu per cabang (shift berjalan, progress, incident open, laporan hari ini); panel peringatan.
- [ ] `[BACKEND]` Statistik: baca dari `summary` (bukan data mentah). Endpoint: `GET /api/admin/stats`.
- [ ] `[BACKEND]` Deteksi shift tanpa laporan: definisi shift aktif cabang yang tidak memiliki shift pada hari berjalan setelah jam selesainya (ADM-RP-06).
- [ ] `[BACKEND]` Ekspor PDF laporan (data dari DB, bukan foto langsung — foto embed dari signed URL jika masih uploaded, atau dari Drive jika purged).
- [ ] `[BACKEND]` Ekspor CSV: laporan, statistik.
- [ ] `[BACKEND]` Mode pratinjau petugas: `is_test=TRUE` pada shift\_instances dan incidents; dikecualikan dari summary dan statistik.
- [ ] `[FRONTEND]` Halaman Laporan admin — tab Statistik: KPI, grafik.
- [ ] `[FRONTEND]` Foto purged tampil sebagai placeholder + link Drive PDF.

Hasil: seluruh 13 modul admin lengkap; foto terarsip otomatis ke Drive.

Verifikasi:

- [ ] `[BACKEND]` Cron archive berjalan: foto di Supabase hilang, PDF ada di Drive dengan nama benar.
- [ ] `[BACKEND]` Supabase Storage usage turun setelah cron archive.
- [ ] `[FRONTEND]` Foto purged → placeholder + link Drive.
- [ ] `[BACKEND]` Summary menghasilkan angka sama dengan hitungan data mentah.
- [ ] `[BACKEND]` Endpoint cron menolak request tanpa `CRON_SECRET` header (401).
- [ ] `[BACKEND]` is\_test=TRUE shift tidak masuk summary dan statistik.

---

## Fase 9 — Produksi — **[BELUM]**

Tugas:

- [ ] `[FRONTEND|BACKEND]` Uji responsif: 320px, HP besar, tablet, desktop.
- [ ] `[FRONTEND]` Uji aksesibilitas: label input, fokus terlihat, kontras memadai, status tidak hanya warna.
- [ ] `[BACKEND]` Tinjauan keamanan: tidak ada secrets di bundel klien (audit `NEXT_PUBLIC_` vars), otorisasi per cabang diuji.
- [ ] `[BACKEND]` Monitoring error: Sentry atau Vercel logs.
- [ ] `[BACKEND]` Uji beban: simulasi 50 petugas serentak, cek Supabase connection pool (max 60 default).
- [ ] `[DATABASE]` Backup terjadwal: Supabase built-in PITR + manual pg\_dump mingguan via cron.
- [ ] `[FRONTEND|BACKEND]` Deploy produksi + verifikasi `GET /api/health` → 200.
- [ ] `[BACKEND]` Runbook: tambah cabang, ubah setting, rotasi service account credential.

Hasil: siap rilis.

Verifikasi: seluruh TESTING.md lulus; tidak ada release blocker.

---

## Di Luar Lingkup

Penjadwalan, tukar shift, izin/cuti, absensi, penggajian, stok, integrasi POS, aplikasi native, multi-bahasa, 2FA, **offline write queue (Dexie)**.

---

## Risiko yang Dipantau

- Supabase Storage 500MB: dimitigasi cron arsip mingguan + threshold 80%.
- PDF generation dengan banyak foto (&gt;50 foto per shift) bisa timeout di Vercel Function 10s: limit embed foto per PDF atau gunakan background streaming.
- Drive API quota upload: arsip mingguan (bukan per-aksi); tambah retry dengan exponential backoff.
- In-memory rate limit hilang saat process restart: tracked di `pin_fail_attempts`, in-memory hanya untuk kecepatan.
- Supabase connection pool 60: cukup untuk 50 concurrent petugas; monitor dan upgrade ke pgBouncer jika perlu.

---

## Perintah (terverifikasi Fase 0)

```bash
# Install (root)
npm install

# Dev web
npm run dev --workspace=apps/web   # default :3000

# DB schema push (development)
npx drizzle-kit push

# DB migration (production)
npx drizzle-kit migrate

# Typecheck
npx tsc --noEmit -p apps/web/tsconfig.json
npx tsc --noEmit -p packages/shared/tsconfig.json

# Build
npm run build --workspace=apps/web
```

