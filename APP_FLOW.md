# App Flow — checklist-shift

Acuan perilaku: `PRD.md`. Dokumen ini memetakan layar, modal, dan alur UI.

## 1. Peta Rute

```
/login
/ganti-pin                       (wajib saat login pertama)
/(petugas)
  /home
  /checklist
  /checklist/[shiftId]
  /checklist/[shiftId]/handover  (baca handover sebelumnya)
  /checklist/[shiftId]/tutup     (stepper tutup shift)
  /incident
  /incident/baru
  /incident/[id]
  /report
  /report/[shiftId]
  /akun
  /notifikasi
/admin
  /dashboard /cabang /akun /shift /checklist-builder /handover-builder
  /kategori-incident /operasi-shift /incident /laporan /pengaturan /audit-log
/r/[token]                       (laporan publik, tanpa login)
```

## 2. Layout Shell

**Petugas (HP, satu kolom):** header sticky (pemilih cabang, avatar) -> konten -> bottom nav `HOME | CHECKLIST | INCIDENT | REPORT`.
- Banner koneksi di bawah header (hanya saat offline).
- Bottom nav disembunyikan di layar kerja penuh (checklist aktif, form incident); diganti sticky action bar.
- Safe-area iOS, target sentuh minimal 48px.

**Admin:** desktop = sidebar 13 modul + topbar (pemilih cabang, mode pratinjau, avatar); HP = sidebar jadi Sheet geser, tabel jadi kartu.

## 3. Alur Utama Petugas

```
Login -> (ganti PIN jika pertama) -> Home
Home -> Checklist -> pilih cabang -> pilih shift
  -> Buka Shift (jadi PJ) / Gabung
  -> Baca handover sebelumnya -> "Sudah dibaca"
  -> Kerjakan checklist per Kategori SOP
  -> PJ: Tutup Shift -> validasi -> handover -> konfirmasi PIN
  -> Laporan terkunci -> Lihat laporan / Bagikan WhatsApp
```

## 4. Layar Petugas

### Login
- Input: username, PIN 6 angka (keypad numerik).
- Error: kredensial salah; akun terkunci (hitung mundur); akun nonaktif.

### Home
1. Kartu shift aktif: nama shift, PJ, progress (12/20), satu tombol (Buka / Gabung / Lanjutkan / Tutup Shift untuk PJ).
2. Banner handover belum dibaca.
3. Tugas berikutnya (jam target terdekat).
4. Incident open (maks 3, "lihat semua").
5. Grid shortcut 2x2: Buat Incident, Checklist, Laporan Hari Ini, Handover Terakhir.
- Kosong: belum ada shift hari ini -> CTA ke Checklist.

### Checklist (tab)
- Daftar shift cabang terpilih; status: Belum dibuka / Berjalan / Ditutup.
- Peringatan lunak bila jam sekarang tidak cocok dengan shift.
- Shift berjalan yang sudah diikuti langsung dibuka (resume, CK-01).

### Checklist aktif
- Header: nama shift, PJ, progress, peserta (avatar stack).
- Akordeon per Kategori SOP dengan progress per kategori.
- Item: judul, penanda wajib, jam target + label (Tepat waktu / Lebih awal / Terlambat), kontrol sesuai tipe, "oleh Rina • 08.12".
- Kontrol: checkbox, kamera + preview, teks, angka (peringatan di luar rentang), OK / Tidak OK.
- Menu titik tiga: Skip (alasan wajib), Batalkan.
- Item selesai tampil redup dengan nama pengisi.
- Sticky bar: "Saya bertugas" atau "Tutup Shift" (PJ).
- Benturan: toast "sudah diselesaikan oleh X", tampilan diperbarui.

### Baca handover
Halaman penuh: field terstruktur, teks bebas, foto, incident open. Tombol "Sudah dibaca" di bawah. Dilewati bila belum ada handover.

### Tutup Shift (stepper 3 langkah, hanya PJ)
1. **Validasi:** daftar item wajib belum selesai; ketuk untuk lompat ke item. Tombol lanjut nonaktif sampai lengkap.
2. **Handover:** field terstruktur (wajib/opsional), teks bebas, foto, toggle "Tidak ada incident".
3. **Konfirmasi:** ringkasan + input PIN -> laporan terbentuk dan terkunci -> layar sukses (Lihat laporan, Bagikan WhatsApp).
- Gagal: PIN salah, koneksi putus (wajib online; pesan jelas, data handover tidak hilang).

### Incident (tab)
Tombol besar "Buat Incident" + daftar incident open (kategori, jam, pelapor, status).

### Form incident
Satu layar: chip kategori -> deskripsi -> foto (maks 5) -> waktu kejadian (default sekarang) -> Kirim (sticky). Wajib online.

### Detail incident
Isi, foto, timeline catatan, kolom tambah catatan. Isi asli tidak bisa diedit.

### Report (tab)
- Navigator tanggal + pemilih cabang + filter shift/rentang.
- Dua kartu ringkasan (Checklist, Incident) dengan toggle ke daftar; desktop dua kolom berdampingan.
- Detail laporan: header, akordeon per Kategori SOP, foto, item di-skip + alasan, incident, handover, kontribusi per petugas (tanpa peringkat), addendum. Bar bawah: Bagikan WhatsApp.
- Laporan berjalan tampil "berjalan" dengan progress terkini.

### Akun dan Notifikasi
Akun: profil, cabang, ganti PIN, preferensi notifikasi, logout (semua perangkat), panduan pasang PWA. Notifikasi: daftar dengan penanda belum dibaca.

## 5. Modal Petugas

| Modal | Tipe |
|---|---|
| Pilih cabang | Drawer bawah |
| Konfirmasi buka shift (jam tidak cocok) | Dialog |
| Skip item (alasan wajib) | Drawer |
| Batalkan centang | Dialog kecil |
| Angka di luar rentang | Inline/toast |
| Item sudah diselesaikan orang lain | Toast |
| Konfirmasi PIN (tutup shift) | Dialog |
| Ambil/preview foto | Layar penuh |
| Bagikan laporan (WhatsApp, salin tautan) | Drawer |
| Tawaran buat incident setelah skip | Drawer |
| Antrian sinkronisasi (menunggu/gagal, coba lagi) | Drawer |
| Ajakan pasang PWA | Banner/Drawer |
| Sesi habis | Dialog |

## 6. Layar Admin

Pola: tabel + filter + tombol tambah; edit di Sheet samping (desktop) atau halaman penuh (HP).

| Modul | Isi utama |
|---|---|
| Dashboard | Kartu per cabang (shift berjalan, progress, incident open); panel peringatan (shift tidak ditutup/dibuka, item wajib terlambat, incident tertua) |
| Cabang | Tabel, form (nama, kode, alamat, zona waktu), salin dari cabang lain |
| Akun | Tabel, form multi-select cabang, reset PIN, buka kunci, paksa logout, nonaktifkan |
| Shift | Daftar per cabang, form jam (lewat tengah malam), salin |
| Checklist Builder | 3 panel: `Cabang > Shift` / pohon Kategori SOP + item (drag & drop) / editor item; duplikasi; pratinjau sebagai petugas. HP: navigasi bertingkat |
| Handover Builder | Daftar field drag & drop + editor + pratinjau |
| Kategori Incident | Tabel dengan edit inline |
| Operasi Shift | Shift berjalan lintas cabang; menu: Tutup paksa, Ganti PJ, Buka atas nama, Void, Addendum, Buka kunci laporan |
| Incident | Tabel + filter; ubah status, catatan admin, tautkan ke shift |
| Laporan dan Statistik | Tab Daftar dan Statistik (KPI, grafik); ekspor PDF/CSV; kelola tautan publik |
| Pengaturan | Form berkelompok: waktu/toleransi, PIN/sesi, tautan publik, template WhatsApp (pratinjau variabel), incident, foto |
| Audit Log | Read-only, filter pelaku/aksi/objek/tanggal, ekspansi sebelum/sesudah |
| Mode pratinjau | Tombol topbar; banner permanen "Mode Pratinjau, data uji" |

## 7. Modal Admin
- **Aksi sensitif** (komponen reusable): ringkasan dampak + alasan wajib + PIN. Dipakai: tutup paksa, ganti PJ, void, buka kunci, reset PIN, ubah peran/akses, nonaktifkan akun.
- Salin dari cabang lain (sumber, cakupan).
- Tambah addendum.
- Buat/cabut tautan publik (masa berlaku, salin).
- Peringatan admin terakhir tidak bisa dinonaktifkan.
- Konfirmasi perubahan template ("berlaku untuk shift berikutnya").
- Daftarkan cabang: input nama, kode, alamat, zona waktu -> simpan.

## 8. Halaman Publik `/r/[token]`
Laporan read-only, tanpa navigasi dan login, siap cetak. Keadaan: kedaluwarsa / dicabut -> halaman informasi sederhana. Foto sesuai pengaturan.

## 9. Alur Sekunder
- **PJ tidak menutup shift:** peringatan di dashboard admin -> admin tutup paksa atau ganti PJ.
- **Login pertama:** Login -> Ganti PIN wajib -> Home.
- **Lupa PIN:** hubungi admin -> reset PIN -> ganti PIN saat login.
- **Offline:** aksi wajib online (buka/tutup shift, aksi admin) tampil disabled dengan pesan "Perlu koneksi internet"; baca checklist/report dari cache.
- **Sesi habis:** dialog -> login ulang.
- **Shift sudah ditutup saat dibuka orang lain:** tampil read-only dengan link ke laporan.

## 10. Keadaan Sistem Wajib Didesain
Loading (skeleton), kosong (ilustrasi singkat + CTA), error jaringan (coba lagi), offline (banner), akses ditolak, shift read-only, sesi habis, benturan sinkronisasi, validasi form.

## 11. Prinsip Visual
- Satu warna aksen, netral abu/putih.
- Status semantik: hijau (Tepat waktu/Selesai), kuning (Lebih awal/Peringatan), merah (Terlambat/Incident), abu (Skip/Void). Selalu sertakan ikon Lucide dan teks, bukan warna saja.
- Komponen shadcn: Button, Card, Badge, Tabs, Accordion, Drawer (vaul), Dialog, Sheet, Table, Form, Input OTP, Progress, Sonner, Skeleton.
- Drawer di HP, Dialog di desktop.

## 12. Keputusan UI Terbuka
1. Checklist aktif: akordeon per Kategori SOP (disarankan) atau tab.
2. Apakah admin memakai HP? Jika tidak, Checklist Builder cukup tiga panel desktop.
