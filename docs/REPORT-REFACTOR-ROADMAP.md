# Roadmap Refactor Laporan SIMRS

Dokumen ini dipakai sebagai peta kerja untuk merombak sistem laporan SIMRS secara bertahap tanpa memutus alur operasional yang sudah jalan.

## Tujuan Utama

1. Menyamakan sumber data laporan dengan data transaksi SIMRS yang dipakai modul operasional.
2. Membuat struktur UI laporan yang konsisten, ringkas, dan mudah diaudit.
3. Mengurangi ketergantungan pada satu file frontend laporan yang terlalu besar.
4. Menstandarkan istilah user-facing agar tidak menampilkan kode mentah seperti `kelas_1`, `gawat_darurat`, atau enum internal lain.

## Peta Modul Saat Ini

Frontend:

- `frontend/src/pages/reports/index.tsx`
- `frontend/src/pages/reports/report-catalog.tsx`
- `frontend/src/lib/api/reports.ts`

Backend routes:

- `backend/routes/reports.go`

Backend handlers:

- `backend/handlers/reports_visits.go`
- `backend/handlers/reports_bpjs.go`
- `backend/handlers/reports_billing.go`
- `backend/handlers/reports_inpatient.go`
- `backend/handlers/reports_pharmacy.go`
- `backend/handlers/reports_penunjang.go`
- `backend/handlers/reports_inventory.go`
- `backend/handlers/reports_hr.go`
- `backend/handlers/reports_kemenkes.go`

## Prioritas Pengerjaan

### 1. Kunjungan & Pasien

Alasan:

- Paling sering dipakai.
- Dari catatan internal, modul ini paling banyak mismatch.

Audit fokus:

- Pastikan hitungan berbasis `registrations`, bukan campuran data pasien dan visit yang tidak konsisten.
- Cek `demographics`, `regions`, `top-diagnoses`, `new-vs-old`, `payment-methods`, `referrals`.
- Pastikan `baru/lama` punya definisi tunggal dan tidak berubah antar laporan.

Target hasil:

- Data demografi terisi.
- Wilayah tidak kosong jika alamat pasien tersedia.
- Diagnosa diambil dari sumber diagnosis yang benar.
- Cara bayar dan baru/lama sinkron dengan data pendaftaran.

### 2. BPJS

Alasan:

- Harus sinkron dengan bridge dan modul operasional BPJS.

Audit fokus:

- `SEP`, `surat kontrol`, `antrean`, `eklaim`, `by-poli`.
- Pastikan laporan memakai model dan tabel yang memang diisi oleh alur BPJS aktif.
- Hindari query yang hanya membaca sebagian tabel lokal tanpa status final.

Target hasil:

- Laporan SEP dan surat kontrol sesuai data yang terlihat di modul BPJS.
- Antrean BPJS sesuai data Antrol / Mobile JKN yang sudah tersimpan.

### 3. Keuangan

Audit fokus:

- Definisi pendapatan, piutang, metode bayar, item type, per ruangan, per dokter.
- Pastikan basis hitung jelas: invoice, payment, atau billing item.

Target hasil:

- Nilai pendapatan dan piutang tidak double count.
- Label user-facing memakai bahasa operasional, bukan id mentah.

### 4. Rawat Inap

Audit fokus:

- BOR, ALOS, BTO, TOI, sensus, daftar pasien dirawat, per ruangan.
- Pastikan data kelas dan ruangan tampil sebagai nama, bukan enum internal.

Target hasil:

- Indikator tidak kosong bila data rawat inap tersedia.
- Sensus dan okupansi mudah dibaca user.

### 5. Penunjang

Audit fokus:

- Order lab, radiologi, hasil kritis, TAT.
- Pastikan semua query mengambil dari order item / hasil yang benar.

Target hasil:

- Top lab dan top radiologi terisi.
- TAT memiliki definisi waktu yang konsisten.

### 6. Inventaris & Stok

Audit fokus:

- Stok obat, kadaluarsa, inventaris, mutasi.
- Pastikan stok berasal dari tabel saldo / mutasi yang aktif dipakai sistem.

Target hasil:

- Data stok tidak kosong.
- Mutasi bisa ditelusuri per periode.

### 7. SDM

Audit fokus:

- Rekap pegawai, daftar dokter, STR/SIP, beban kerja.

Target hasil:

- Masa berlaku lisensi jelas.
- Workload dokter memakai sumber kunjungan yang konsisten.

### 8. Kemenkes / RL

Audit fokus:

- RL 1.2, RL 3.1, RL 3.2, RL 4A, RL 5.1, indikator mutu.
- Pastikan seluruh label user-facing memakai istilah RL yang benar.
- Pastikan mapping kelas, jenis layanan, dan jenis tenaga tidak menampilkan kode internal mentah.

Target hasil:

- Format siap audit.
- Output lebih mudah divalidasi dengan kebutuhan pelaporan resmi.

## Strategi Refactor Frontend

1. Pecah halaman laporan dari satu file besar menjadi modul per kategori.
2. Sediakan komponen bersama:
   - `ReportPageShell`
   - `ReportFilterBar`
   - `ReportKPIGrid`
   - `ReportChartPanel`
   - `ReportDataTable`
   - `ReportEmptyState`
3. Simpan metadata kategori, badge audit, dan deskripsi di katalog terpisah.
4. Tambahkan status kualitas data di setiap modul:
   - `Terverifikasi`
   - `Perlu Audit`
   - `Perlu Sinkronisasi`

## Strategi Refactor Backend

1. Audit query per handler terhadap tabel transaksi asli.
2. Standarkan parsing rentang tanggal dan parameter filter.
3. Pisahkan helper agregasi bila beberapa laporan memakai logika yang sama.
4. Tambahkan normalisasi label sebelum data dikirim ke frontend.

## Checklist Validasi

- Angka laporan cocok dengan data SIMRS untuk sampel periode tertentu.
- Label yang tampil mudah dipahami user.
- Empty state tidak menyesatkan.
- Export Excel mengandung data yang sama dengan tampilan web.
- Modul BPJS dan RL tidak menampilkan enum internal mentah.

## Urutan Implementasi

1. Rapikan fondasi frontend laporan.
2. Audit dan perbaiki Kunjungan & Pasien.
3. Audit dan perbaiki BPJS.
4. Audit dan perbaiki Keuangan.
5. Lanjut Rawat Inap, Penunjang, Inventaris, SDM, Kemenkes.
