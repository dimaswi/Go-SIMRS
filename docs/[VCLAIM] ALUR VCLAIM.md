# Alur VCLAIM di SIMRS

## Daftar Isi

1. [Pendahuluan](#pendahuluan)
2. [Alur Integrasi VClaim](#alur-integrasi-vclaim)
3. [Alur Pembuatan SEP](#alur-pembuatan-sep)
4. [Alur Pendaftaran dengan BPJS](#alur-pendaftaran-dengan-bpjs)
5. [Endpoint VClaim yang Digunakan](#endpoint-vclaim-yang-digunakan)
6. [Sequence Diagram](#sequence-diagram)

---

## Pendahuluan

### Apa itu VClaim?

**VClaim (Virtual Claim)** adalah layanan web service dari BPJS Kesehatan yang digunakan untuk:

1. **Verifikasi Kepesertaan** - Cek status aktif peserta BPJS
2. **Penerbitan SEP** - Surat Eligibilitas Peserta (wajib untuk setiap kunjungan JKN)
3. **Pengajuan Rujukan** - Kelola rujukan dari FKTP
4. **Data Referensi** - Poli, diagnosa, prosedur, faskes, dokter DPJP
5. **Riwayat Pelayanan** - Histori kunjungan dan diagnosa pasien

### Kredensial VClaim

| Parameter | Keterangan |
|-----------|------------|
| `cons_id` | Consumer ID dari BPJS |
| `secret_key` | Secret Key untuk generate signature |
| `user_key` | User Key untuk header request |
| `kode_ppk` | Kode Faskes Rumah Sakit |

### Base URL

| Environment | URL |
|-------------|-----|
| Development | `https://apijkn-dev.bpjs-kesehatan.go.id/vclaim-rest-dev` |
| Production | `https://apijkn.bpjs-kesehatan.go.id/vclaim-rest` |

---

## Alur Integrasi VClaim

### Kapan VClaim Dipanggil?

VClaim terintegrasi pada **proses pendaftaran pasien** di SIMRS ketika:

1. Petugas memilih **Payment Method = BPJS**
2. Sistem akan otomatis:
   - Cek kepesertaan pasien
   - Cek rujukan (jika dari FKTP)
   - Membuat SEP

### Modal Pendaftaran

Di SIMRS ini terdapat **3 jalur pendaftaran**:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           JALUR PENDAFTARAN                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐           │
│  │ 1. REGISTRASI    │  │ 2. ANTREAN KIOSK │  │ 3. JKN MOBILE    │           │
│  │    LANGSUNG      │  │    (Mesin di RS) │  │    (Booking App) │           │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘           │
│           │                     │                     │                      │
│           │ Pasien datang       │ Pasien ambil        │ Pasien booking       │
│           │ langsung ke loket   │ nomor di mesin      │ via aplikasi         │
│           │                     │ kiosk RS            │ JKN Mobile           │
│           │                     │                     │                      │
│           └─────────────────────┴─────────────────────┘                      │
│                                 │                                            │
│                                 ▼                                            │
│                    ┌─────────────────────────┐                               │
│                    │   FORM PENDAFTARAN      │                               │
│                    │   - Pilih Pasien        │                               │
│                    │   - Pilih Poli/Ruangan  │                               │
│                    │   - Pilih Dokter        │                               │
│                    │   - Pilih Pembayaran ◄──┼── [BPJS / Cash / Asuransi]   │
│                    └───────────┬─────────────┘                               │
│                                │                                             │
│                                ▼                                             │
│                   ┌──────────────────────────┐                               │
│                   │ Payment Method = BPJS?   │                               │
│                   └────────────┬─────────────┘                               │
│                           Ya   │   Tidak                                     │
│                   ┌────────────┴────────────┐                                │
│                   ▼                         ▼                                │
│          ┌─────────────────┐      ┌─────────────────┐                       │
│          │  PROSES VCLAIM  │      │  SIMPAN LANGSUNG│                       │
│          │  (Buat SEP)     │      │  (Tanpa SEP)    │                       │
│          └─────────────────┘      └─────────────────┘                       │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Perbedaan 3 Jalur Pendaftaran

| Aspek | Registrasi Langsung | Antrean KIOSK | JKN Mobile |
|-------|---------------------|---------------|------------|
| **Sumber** | Walk-in ke loket | Mesin KIOSK di RS | Aplikasi JKN Mobile |
| **Booking** | Tidak ada | Tidak ada (ambil nomor saat itu) | Sudah booking H-7 s/d H-1 |
| **Data Awal** | Kosong | Kosong | Pre-filled dari BPJS |
| **Rujukan** | Input manual | Input manual | Sudah tervalidasi |
| **Integrasi BPJS Antrian** | Tidak | Tidak | Ya (Task 1-7) |

---

## Alur Pembuatan SEP

### Flow Pembuatan SEP di Pendaftaran

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ALUR PEMBUATAN SEP OTOMATIS                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ STEP 1: Validasi Input Pendaftaran                             │    │
│  │ - Cek nomor BPJS wajib diisi                                   │    │
│  │ - Cek poli tujuan terdaftar di mapping BPJS                    │    │
│  │ - Cek dokter terdaftar sebagai DPJP                            │    │
│  └────────────────────────────────────┬───────────────────────────┘    │
│                                       │                                 │
│                                       ▼                                 │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ STEP 2: Cek Kepesertaan Pasien                                 │    │
│  │ GET /Peserta/nokartu/{noBPJS}/tglSEP/{tglSEP}                  │    │
│  │                                                                │    │
│  │ Response:                                                      │    │
│  │ - Status kepesertaan (aktif/tidak aktif)                       │    │
│  │ - Kelas rawat peserta                                          │    │
│  │ - Data peserta (nama, NIK, tanggal lahir)                      │    │
│  │ - Faskes tingkat 1 (PPK1)                                      │    │
│  └────────────────────────────────────┬───────────────────────────┘    │
│                                       │                                 │
│                    Peserta Aktif?     │                                 │
│                         │             │                                 │
│              ┌──────────┴──────────┐  │                                 │
│              ▼                     ▼  │                                 │
│          [ Ya ]              [ Tidak ]│                                 │
│              │                     │  │                                 │
│              │              ┌──────┴──┴───────────────────────────┐    │
│              │              │ ERROR: Peserta tidak aktif          │    │
│              │              │ Tampilkan pesan ke petugas          │    │
│              │              └────────────────────────────────────┘    │
│              ▼                                                         │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ STEP 3: Cek Rujukan (untuk Rawat Jalan)                        │    │
│  │                                                                │    │
│  │ A. Pasien dengan Rujukan dari FKTP:                            │    │
│  │    GET /Rujukan/RS/Nomor/{noRujukan}                           │    │
│  │    atau                                                        │    │
│  │    GET /Rujukan/Peserta/{noBPJS}                               │    │
│  │                                                                │    │
│  │ B. Pasien Kontrol Ulang:                                       │    │
│  │    GET /RencanaKontrol/ListSpesialistik/...                    │    │
│  │                                                                │    │
│  │ C. Pasien PRB (Program Rujuk Balik):                           │    │
│  │    GET /PRB/Peserta/{noBPJS}                                   │    │
│  │                                                                │    │
│  │ Note: Untuk IGD tidak perlu rujukan                            │    │
│  └────────────────────────────────────┬───────────────────────────┘    │
│                                       │                                 │
│                                       ▼                                 │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ STEP 4: Buat SEP (Surat Eligibilitas Peserta)                  │    │
│  │ POST /SEP/2.0/insert                                           │    │
│  │                                                                │    │
│  │ Request Body:                                                  │    │
│  │ - noKartu (Nomor BPJS)                                         │    │
│  │ - tglSep (Tanggal SEP)                                         │    │
│  │ - ppkPelayanan (Kode RS)                                       │    │
│  │ - jnsPelayanan (1=Rawat Inap, 2=Rawat Jalan)                   │    │
│  │ - klsRawat (Kelas rawat sesuai hak peserta)                    │    │
│  │ - noMR (No Rekam Medis pasien)                                 │    │
│  │ - rujukan (Data rujukan dari FKTP)                             │    │
│  │ - diagnosa (Diagnosa awal)                                     │    │
│  │ - poli (Kode poli tujuan)                                      │    │
│  │ - dpjpLayan (Kode dokter DPJP)                                 │    │
│  │ - catatan                                                      │    │
│  │ - user (Username petugas)                                      │    │
│  └────────────────────────────────────┬───────────────────────────┘    │
│                                       │                                 │
│                                       ▼                                 │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ STEP 5: Simpan Data                                            │    │
│  │                                                                │    │
│  │ - Simpan Registration dengan nomor SEP                         │    │
│  │ - Simpan log request/response VClaim                           │    │
│  │ - Buat Visit record                                            │    │
│  │ - Buat Room Queue (antrian poli)                               │    │
│  │ - Update task BPJS Antrian (jika dari booking JKN)             │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Alur Pendaftaran dengan BPJS

### 1. Registrasi Langsung (Walk-in)

Pasien datang langsung ke RS tanpa booking sebelumnya.

```
┌─────────────────────────────────────────────────────────────────────────┐
│              ALUR: REGISTRASI LANGSUNG (WALK-IN)                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [Pasien Datang] ──► [Ambil Nomor Antrian] ──► [Dipanggil Loket]       │
│                                                                         │
│                              ▼                                          │
│                 ┌─────────────────────────┐                             │
│                 │    FORM PENDAFTARAN     │                             │
│                 │                         │                             │
│                 │ • Cari/Input Pasien     │                             │
│                 │ • Pilih Poli Tujuan     │                             │
│                 │ • Pilih Dokter          │                             │
│                 │ • Payment: [BPJS] ◄─────┼─── Trigger VClaim          │
│                 │ • Input No. BPJS        │                             │
│                 │ • Input No. Rujukan     │                             │
│                 │   (opsional)            │                             │
│                 │ • Keluhan Utama         │                             │
│                 └───────────┬─────────────┘                             │
│                             │                                           │
│                             ▼                                           │
│                 ┌─────────────────────────┐                             │
│                 │  PROSES VCLAIM:         │                             │
│                 │  1. Cek Kepesertaan     │                             │
│                 │  2. Cek/Cari Rujukan    │                             │
│                 │  3. Buat SEP            │                             │
│                 └───────────┬─────────────┘                             │
│                             │                                           │
│                   Berhasil? │                                           │
│              ┌──────────────┴──────────────┐                            │
│              ▼                             ▼                            │
│          [ Ya ]                      [ Gagal ]                          │
│              │                             │                            │
│              │                   ┌─────────┴───────────┐                │
│              │                   │ Tampilkan Error:    │                │
│              │                   │ - Peserta non-aktif │                │
│              │                   │ - Rujukan expired   │                │
│              │                   │ - Quota poli habis  │                │
│              │                   │ - dll               │                │
│              │                   └─────────────────────┘                │
│              ▼                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ SIMPAN PENDAFTARAN:                                             │   │
│  │                                                                 │   │
│  │ Registration {                                                  │   │
│  │   registration_number: "REG20260203001"                         │   │
│  │   patient_id: 123                                               │   │
│  │   destination_room_id: 5 (Poli Umum)                            │   │
│  │   doctor_id: 10                                                 │   │
│  │   payment_method: "bpjs"                                        │   │
│  │   bpjs_number: "0001234567890"                                  │   │
│  │   sep_number: "0089S0021124V000001" ◄── dari VClaim             │   │
│  │   rujukan_number: "0301R0010124P000001"                         │   │
│  │   status: "registered"                                          │   │
│  │ }                                                               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                             │                                           │
│                             ▼                                           │
│              [Cetak Bukti Pendaftaran + SEP]                            │
│                             │                                           │
│                             ▼                                           │
│              [Pasien Menunggu Dipanggil di Poli]                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2. Dari Antrean KIOSK

Pasien mengambil nomor antrian melalui mesin KIOSK di RS.

```
┌─────────────────────────────────────────────────────────────────────────┐
│              ALUR: DARI ANTREAN KIOSK (MESIN DI RS)                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [Pasien Datang ke RS] ──► [Mesin KIOSK]                               │
│                                   │                                     │
│                                   ▼                                     │
│                     ┌─────────────────────────┐                         │
│                     │    LAYAR KIOSK          │                         │
│                     │                         │                         │
│                     │ • Pilih Jenis Layanan   │                         │
│                     │   - Rawat Jalan         │                         │
│                     │   - Laboratorium        │                         │
│                     │   - Radiologi           │                         │
│                     │   - dll                 │                         │
│                     │                         │                         │
│                     │ • Pilih Tipe Pasien     │                         │
│                     │   - Umum                │                         │
│                     │   - BPJS                │                         │
│                     └───────────┬─────────────┘                         │
│                                 │                                       │
│                                 ▼                                       │
│                     ┌─────────────────────────┐                         │
│                     │  CETAK NOMOR ANTRIAN    │                         │
│                     │  Contoh: A-001 (Umum)   │                         │
│                     │          B-001 (BPJS)   │                         │
│                     └───────────┬─────────────┘                         │
│                                 │                                       │
│                     [Pasien Menunggu Dipanggil Loket]                   │
│                                 │                                       │
│                                 ▼                                       │
│                     ┌─────────────────────────┐                         │
│                     │   DIPANGGIL KE LOKET    │                         │
│                     │   (Sama seperti         │                         │
│                     │    Registrasi Langsung) │                         │
│                     └───────────┬─────────────┘                         │
│                                 │                                       │
│                                 ▼                                       │
│                 ┌─────────────────────────────────┐                     │
│                 │       FORM PENDAFTARAN          │                     │
│                 │  (Link queue_id dari KIOSK)     │                     │
│                 │                                 │                     │
│                 │ • Cari/Input Pasien             │                     │
│                 │ • Pilih Poli Tujuan             │                     │
│                 │ • Pilih Dokter                  │                     │
│                 │ • Payment: [BPJS] ◄─────────────┼─ Trigger VClaim    │
│                 │ • Input No. BPJS                │                     │
│                 │ • Input No. Rujukan (opsional)  │                     │
│                 └───────────┬─────────────────────┘                     │
│                             │                                           │
│                             ▼                                           │
│                 ┌─────────────────────────┐                             │
│                 │  PROSES VCLAIM:         │                             │
│                 │  1. Cek Kepesertaan     │                             │
│                 │  2. Cek/Cari Rujukan    │                             │
│                 │  3. Buat SEP            │                             │
│                 └───────────┬─────────────┘                             │
│                             │                                           │
│                             ▼                                           │
│              [Simpan Pendaftaran + Cetak SEP]                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3. Dari JKN Mobile (Antrian Online BPJS)

Pasien sudah booking online melalui aplikasi JKN Mobile.

```
┌─────────────────────────────────────────────────────────────────────────┐
│              ALUR: DARI JKN MOBILE (ANTRIAN ONLINE BPJS)                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [Pasien Booking via JKN Mobile]                                        │
│              │                                                          │
│              ▼                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ BPJS Antrian Online (Data dari Webhook):                        │   │
│  │ - kodebooking: "1234567890ABCD"                                 │   │
│  │ - nomorkartu: "0001234567890"                                   │   │
│  │ - nik: "3201234567890001"                                       │   │
│  │ - tanggalperiksa: "2026-02-03"                                  │   │
│  │ - kodepoli: "INT"                                               │   │
│  │ - kodedokter: "12345"                                           │   │
│  │ - nomorreferensi: "0301R0010124P000001" ◄── Rujukan sudah ada   │   │
│  │ - jenisreferensi: 1 (1=Rujukan, 2=Kontrol)                      │   │
│  └────────────────────────────────────────────────────────────┬────┘   │
│                                                               │         │
│                  [SIMRS menerima via Webhook]                 │         │
│                              │                                          │
│                              ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ SIMRS: Simpan ke tabel bpjs_queues                              │   │
│  │ + Update Task 1 (Checkin) otomatis                              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│  [Pasien Datang ke RS] ──► [Check-in di Loket / Anjungan]              │
│                                                                         │
│                              ▼                                          │
│                 ┌─────────────────────────┐                             │
│                 │   FORM PENDAFTARAN      │                             │
│                 │   (Data Pre-filled)     │                             │
│                 │                         │                             │
│                 │ • Pasien: Auto-search   │◄── dari nomorkartu/nik     │
│                 │ • Poli: Auto-select     │◄── dari kodepoli           │
│                 │ • Dokter: Auto-select   │◄── dari kodedokter         │
│                 │ • Payment: BPJS (fixed) │                             │
│                 │ • No. BPJS: Pre-filled  │                             │
│                 │ • No. Rujukan: Pre-filled│                            │
│                 └───────────┬─────────────┘                             │
│                             │                                           │
│                   Petugas Verifikasi & Submit                           │
│                             │                                           │
│                             ▼                                           │
│                 ┌─────────────────────────┐                             │
│                 │  PROSES VCLAIM:         │                             │
│                 │  1. Cek Kepesertaan     │                             │
│                 │  2. Validasi Rujukan    │                             │
│                 │  3. Buat SEP            │                             │
│                 └───────────┬─────────────┘                             │
│                             │                                           │
│                             ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ SIMPAN PENDAFTARAN + UPDATE BPJS ANTRIAN:                       │   │
│  │                                                                 │   │
│  │ Registration {                                                  │   │
│  │   queue_id: null (tidak link ke queue lokal)                    │   │
│  │   bpjs_queue_id: 45 ◄── Link ke bpjs_queues                     │   │
│  │   ...                                                           │   │
│  │   sep_number: "0089S0021124V000001"                             │   │
│  │ }                                                               │   │
│  │                                                                 │   │
│  │ + Update Task BPJS Antrian:                                     │   │
│  │   - Task 3: Pendaftaran selesai                                 │   │
│  │   - Task 4: Mulai menunggu poli                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                             │                                           │
│                             ▼                                           │
│              [Cetak Bukti Pendaftaran + SEP]                            │
│                             │                                           │
│                             ▼                                           │
│              [Pasien Menunggu Dipanggil di Poli]                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Endpoint VClaim yang Digunakan

### 1. Kepesertaan

| Method | Endpoint | Fungsi |
|--------|----------|--------|
| GET | `/Peserta/nokartu/{noKartu}/tglSEP/{tglSEP}` | Cek peserta by nomor kartu |
| GET | `/Peserta/nik/{nik}/tglSEP/{tglSEP}` | Cek peserta by NIK |

### 2. Rujukan

| Method | Endpoint | Fungsi |
|--------|----------|--------|
| GET | `/Rujukan/RS/Nomor/{noRujukan}` | Detail rujukan by nomor |
| GET | `/Rujukan/Peserta/{noBPJS}` | List rujukan peserta |
| GET | `/Rujukan/RS/Peserta/{noBPJS}` | List rujukan khusus RS |
| GET | `/Rujukan/JumlahSEP/{noRujukan}` | Cek sisa quota rujukan |

### 3. SEP (Surat Eligibilitas Peserta)

| Method | Endpoint | Fungsi |
|--------|----------|--------|
| POST | `/SEP/2.0/insert` | Buat SEP baru |
| PUT | `/SEP/2.0/update` | Update SEP |
| DELETE | `/SEP/2.0/delete` | Hapus/Batal SEP |
| GET | `/SEP/{noSEP}` | Detail SEP by nomor |
| POST | `/SEP/pengajuanSEP` | Pengajuan SEP (approval) |
| POST | `/SEP/aprovalSEP` | Approval SEP |

### 4. Rencana Kontrol

| Method | Endpoint | Fungsi |
|--------|----------|--------|
| GET | `/RencanaKontrol/ListSpesialistik/...` | List spesialistik |
| GET | `/RencanaKontrol/JadwalPraktekDokter/...` | Jadwal praktek |
| POST | `/RencanaKontrol/insert` | Buat surat kontrol |
| PUT | `/RencanaKontrol/Update` | Update surat kontrol |
| DELETE | `/RencanaKontrol/Delete` | Hapus surat kontrol |

### 5. Referensi

| Method | Endpoint | Fungsi |
|--------|----------|--------|
| GET | `/referensi/poli/{nama}` | Search poli by nama |
| GET | `/referensi/diagnosa/{kode}` | Search diagnosa ICD-10 |
| GET | `/referensi/prosedur/{kode}` | Search prosedur ICD-9 CM |
| GET | `/referensi/faskes/{nama}/{jenis}` | Search faskes |
| GET | `/referensi/dokter/pelayanan/{jnsPelayanan}/tglPelayanan/{tglPelayanan}/Spesialis/{spesialis}` | List dokter DPJP |

---

## Sequence Diagram

### Sequence: Pendaftaran Pasien BPJS

```
┌───────┐    ┌───────────┐    ┌───────────┐    ┌───────────┐    ┌─────────┐
│Petugas│    │  SIMRS    │    │  VClaim   │    │  Database │    │  BPJS   │
│ Loket │    │  Backend  │    │  Service  │    │           │    │ Antrian │
└───┬───┘    └─────┬─────┘    └─────┬─────┘    └─────┬─────┘    └────┬────┘
    │              │                │                │               │
    │ Submit Form  │                │                │               │
    │ (BPJS)       │                │                │               │
    │─────────────>│                │                │               │
    │              │                │                │               │
    │              │ Validasi Input │                │               │
    │              │───────────────>│                │               │
    │              │                │                │               │
    │              │                │ Cek Peserta    │               │
    │              │                │───────────────>│               │
    │              │                │<───────────────│               │
    │              │                │                │               │
    │              │                │ Cek Rujukan    │               │
    │              │                │───────────────>│               │
    │              │                │<───────────────│               │
    │              │                │                │               │
    │              │                │ Buat SEP       │               │
    │              │                │───────────────>│               │
    │              │                │<───────────────│               │
    │              │                │                │               │
    │              │ SEP Response   │                │               │
    │              │<───────────────│                │               │
    │              │                │                │               │
    │              │ Simpan Registration             │               │
    │              │────────────────────────────────>│               │
    │              │                                 │               │
    │              │ Update Task (jika dari booking) │               │
    │              │────────────────────────────────────────────────>│
    │              │                                 │               │
    │ Response     │                                 │               │
    │<─────────────│                                 │               │
    │              │                                 │               │
```

---

## Catatan Implementasi

### Error Handling

| Kode | Pesan | Penanganan |
|------|-------|------------|
| `201` | Peserta tidak ditemukan | Verifikasi nomor kartu |
| `202` | Peserta non-aktif | Info ke pasien untuk aktivasi |
| `203` | Rujukan tidak ditemukan | Cek nomor rujukan / minta baru |
| `204` | Rujukan expired | Minta rujukan baru dari FKTP |
| `205` | Quota SEP habis | Info kuota rujukan sudah terpakai |
| `206` | Poli tutup | Pilih tanggal/waktu lain |

### Field Mapping

| Field SIMRS | Field VClaim | Keterangan |
|-------------|--------------|------------|
| `patient.no_bpjs` | `noKartu` | Nomor kartu BPJS |
| `patient.no_rm` | `noMR` | No Rekam Medis |
| `room.bpjs_code` | `kodePoli` | Kode poli mapping |
| `doctor.bpjs_code` | `kodeDPJP` | Kode dokter DPJP |
| `registration.sep_number` | `noSep` | Nomor SEP hasil |

### Konfigurasi yang Diperlukan

1. **Mapping Poli** - Setiap Room/Poli harus dimapping ke kode poli BPJS
2. **Mapping Dokter** - Setiap Dokter harus dimapping ke kode DPJP BPJS
3. **Kredensial VClaim** - cons_id, secret_key, user_key, kode_ppk

---

## TODO Implementation

- [ ] VClaim Service Client (`backend/services/bpjs/vclaim.go`)
- [ ] Endpoint Cek Kepesertaan
- [ ] Endpoint Cek Rujukan
- [ ] Endpoint Buat SEP
- [ ] Endpoint Update SEP
- [ ] Endpoint Delete SEP
- [ ] Integrasi di Registration Handler
- [ ] Model untuk menyimpan data SEP
- [ ] Frontend: Modal VClaim di Form Pendaftaran
- [ ] Frontend: Tampilan status SEP

---

*Dokumentasi ini akan dilengkapi dengan format Request/Response setelah menerima spesifikasi dari BPJS.*
