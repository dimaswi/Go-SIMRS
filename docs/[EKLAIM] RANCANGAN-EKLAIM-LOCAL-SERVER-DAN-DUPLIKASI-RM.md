# Rancangan Fitur E-Klaim: Local Server Integration & Duplikasi Rekam Medis

**Tanggal:** 15 Februari 2026  
**Status:** DRAFT  
**Versi:** 1.0

---

## Daftar Isi

1. [Ringkasan Fitur](#ringkasan-fitur)
2. [Arsitektur Sistem](#arsitektur-sistem)
3. [Fitur 1: Duplikasi Rekam Medis untuk E-Klaim](#fitur-1-duplikasi-rekam-medis-untuk-e-klaim)
4. [Fitur 2: Integrasi E-Klaim Local Server](#fitur-2-integrasi-e-klaim-local-server)
5. [Alur Kerja Lengkap](#alur-kerja-lengkap)
6. [Database Schema (Migrasi)](#database-schema-migrasi)
7. [API Endpoints (Backend)](#api-endpoints-backend)
8. [Implementasi Backend (Go)](#implementasi-backend-go)
9. [Implementasi Frontend (React)](#implementasi-frontend-react)
10. [Konfigurasi](#konfigurasi)
11. [Tahapan Implementasi](#tahapan-implementasi)

---

## Ringkasan Fitur

### Kebutuhan Utama

1. **Duplikasi Rekam Medis (RM) untuk E-Klaim** — Membuat salinan data RM (diagnosis, prosedur, tarif) dari visit asli ke dalam E-Klaim entry, salinan ini **dapat diedit** tanpa mempengaruhi RM asli.

2. **Integrasi E-Klaim Local Server** — SIMRS berkomunikasi dengan **E-Klaim server lokal** (biasanya aplikasi desktop BPJS yang berjalan di komputer RS) untuk melakukan grouping, finalisasi, dan pengiriman klaim, sebelum data dikirim ke server BPJS pusat.

### Mengapa Duplikasi RM?

| Aspek | RM Asli (Visit) | RM Duplikasi (E-Klaim) |
|-------|-----------------|------------------------|
| **Tujuan** | Dokumentasi medis resmi | Koding & klaim BPJS |
| **Siapa edit** | Dokter, Perawat | Koder / Petugas Klaim |
| **Kode ICD** | ICD-10 standar | ICD-10 2010 IM (bisa beda) |
| **Bisa diedit setelah pulang** | Tidak/Terbatas | Ya (untuk koreksi koding) |
| **Diagnosis** | Klinis (apa adanya) | Optimasi koding (upcode-free) |

---

## Arsitektur Sistem

```
┌───────────────────────────────────────────────────────────────────────────┐
│                            SIMRS Go-SIMRS                                │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌──────────────┐    Duplikasi RM     ┌──────────────────┐               │
│  │ Visit/RM     │ ─────────────────►  │ EKlaim Draft     │               │
│  │ (Data Asli)  │   (copy + editable) │ (Salinan Editable)│              │
│  │              │                     │                    │              │
│  │ • Diagnosis  │                     │ • Diagnosis iDRG   │             │
│  │ • Procedures │                     │ • Procedures iDRG  │             │
│  │ • Tarif Billing│                   │ • Tarif RS (edit)  │             │
│  └──────────────┘                     └────────┬───────────┘             │
│                                                │                         │
│                                     ┌──────────▼───────────┐             │
│                                     │  EKlaim Service      │             │
│                                     │  (Backend Go)        │             │
│                                     └──────────┬───────────┘             │
│                                                │                         │
└────────────────────────────────────────────────┼─────────────────────────┘
                                                 │ HTTP POST
                                                 ▼
                          ┌──────────────────────────────────────┐
                          │       E-Klaim Local Server           │
                          │    (Aplikasi Desktop BPJS di RS)     │
                          │                                      │
                          │  URL: http://localhost:9091/api/eklaim│
                          │  atau http://192.168.x.x:9091/...   │
                          │                                      │
                          │  Functions:                          │
                          │  • new_claim                        │
                          │  • set_claim_data                   │
                          │  • grouper                          │
                          │  • get_claim_data                   │
                          │  • claim_final                      │
                          │  • claim_print                      │
                          │  • delete_claim                     │
                          │  • get_claim_status                 │
                          └──────────────────┬───────────────────┘
                                             │ Sinkronisasi otomatis
                                             ▼
                          ┌──────────────────────────────────────┐
                          │      E-Klaim Server BPJS Pusat       │
                          │  (eklaim.bpjs-kesehatan.go.id)       │
                          └──────────────────────────────────────┘
```

---

## Fitur 1: Duplikasi Rekam Medis untuk E-Klaim

### Konsep

Saat petugas klaim membuat E-Klaim baru dari sebuah visit, sistem akan **otomatis menduplikasi** data RM dari visit tersebut ke dalam E-Klaim entry. Data duplikasi ini bersifat **independen** — dapat diedit tanpa mempengaruhi RM asli.

### Data yang Diduplikasi

```
┌─────────────────────────────────────────────────────────────────────┐
│  SOURCE: Visit (RM Asli)              TARGET: EKlaim (Duplikasi)   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Visit.SEP                            │                            │
│  ├── no_sep ──────────────────────────► eklaim.no_sep              │
│  ├── no_kartu ────────────────────────► eklaim.no_kartu            │
│  └── tgl_sep ─────────────────────────► (referensi)                │
│                                        │                            │
│  Patient                               │                            │
│  ├── tgl_lahir ───────────────────────► eklaim.tgl_lahir           │
│  ├── jenis_kelamin ───────────────────► eklaim.jenis_kelamin       │
│  └── berat_badan ─────────────────────► eklaim.berat_badan        │
│                                        │                            │
│  Visit                                 │                            │
│  ├── check_in_time ───────────────────► eklaim.tgl_masuk           │
│  ├── end_time/discharge ──────────────► eklaim.tgl_pulang          │
│  ├── visit_type ──────────────────────► eklaim.jenis_rawat         │
│  └── inpatient_days ──────────────────► eklaim.los                 │
│                                        │                            │
│  Diagnoses[] (dari tbl diagnoses)      │                            │
│  ├── icd10_code ──────────────────────► eklaim_diagnoses.code      │
│  ├── icd10_name ──────────────────────► eklaim_diagnoses.name      │
│  ├── type (primary/secondary) ────────► eklaim_diagnoses.is_primary│
│  └── sequence ────────────────────────► eklaim_diagnoses.sequence  │
│                                        │ source = "idrg"           │
│                                        │                            │
│  VisitProcedures[] / Billing Items     │                            │
│  ├── icd9_code ───────────────────────► eklaim_procedures.code     │
│  ├── name ────────────────────────────► eklaim_procedures.name     │
│  └── (default multiplicity=1) ────────► eklaim_procedures.mult    │
│                                        │ source = "idrg"           │
│                                        │                            │
│  Billing Summary                       │                            │
│  ├── tarif_tindakan ──────────────────► eklaim.tarif_prosedur      │
│  ├── tarif_alkes ─────────────────────► eklaim.tarif_alkes         │
│  ├── tarif_obat ──────────────────────► eklaim.tarif_obat          │
│  ├── tarif_kamar ─────────────────────► eklaim.tarif_kamar         │
│  └── tarif_lainnya ───────────────────► eklaim.tarif_lainnya       │
│                                                                     │
│  SEMUA DATA DUPLIKASI BISA DIEDIT oleh Koder/Petugas Klaim        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Field Tracking (Audit Trail)

Setiap E-Klaim entry menyimpan referensi ke data asal sehingga bisa dilakukan **perbandingan** antara RM asli dan data klaim yang dikirim:

```go
// Tambahan field di model EKlaim
type EKlaim struct {
    // ... existing fields ...

    // Duplikasi RM tracking
    DuplicatedFromVisitID  *uint      `json:"duplicated_from_visit_id"`
    DuplicatedAt           *time.Time `json:"duplicated_at"`
    DuplicatedByID         *uint      `json:"duplicated_by_id"`

    // Snapshot data asli (JSON) - untuk perbandingan
    OriginalDiagnosesJSON  string     `gorm:"type:text" json:"original_diagnoses_json,omitempty"`
    OriginalProceduresJSON string     `gorm:"type:text" json:"original_procedures_json,omitempty"`
    OriginalTarifJSON      string     `gorm:"type:text" json:"original_tarif_json,omitempty"`
}
```

### Endpoint Duplikasi RM

```
POST /api/eklaim/duplicate-from-visit
```

**Request Body:**
```json
{
  "visit_id": 1234,
  "include_diagnoses": true,
  "include_procedures": true,
  "include_tarif": true
}
```

**Response:**
```json
{
  "data": {
    "id": 56,
    "visit_id": 1234,
    "state": "DRAFT",
    "no_sep": "0301R0011124010001",
    "diagnoses": [...],
    "procedures": [...],
    "tarif_rs": 2500000,
    "duplicated_from_visit_id": 1234,
    "duplicated_at": "2026-02-15T10:30:00Z"
  },
  "original": {
    "diagnoses": [...],
    "procedures": [...],
    "tarif": {...}
  },
  "diff_warnings": [
    "Diagnosis A09.0 menggunakan kode standar, pertimbangkan kode IM A09.0+1"
  ],
  "message": "E-Klaim berhasil dibuat dari duplikasi RM"
}
```

### UI: Perbandingan RM Asli vs Klaim

```
┌─────────────────────────────────────────────────────────────────────┐
│  E-Klaim #56 — SEP: 0301R0011124010001                             │
├────────────────────────────┬────────────────────────────────────────┤
│  RM ASLI (Read-Only)       │  DATA KLAIM (Editable)                │
├────────────────────────────┼────────────────────────────────────────┤
│                            │                                        │
│  Diagnosis Utama:          │  Diagnosis Utama:                      │
│  A09.0 - Gastroenteritis   │  [A09.0] - Gastroenteritis    [Edit]  │
│                            │                                        │
│  Diagnosis Sekunder:       │  Diagnosis Sekunder:                   │
│  E11.9 - DM Tipe 2        │  [E11.9] - DM Tipe 2          [Edit]  │
│                            │  [+ Tambah Diagnosis]                  │
│                            │                                        │
│  Prosedur:                 │  Prosedur:                             │
│  99.29 - Injeksi infus     │  [99.29] - Injeksi infus      [Edit]  │
│                            │  Multiplicity: [1]  Setting: [NON_OR] │
│                            │  [+ Tambah Prosedur]                   │
│                            │                                        │
│  Tarif RS: Rp 2.500.000   │  Tarif RS: [2.500.000]         [Edit] │
│  ├ Prosedur: Rp 1.000.000 │  ├ Prosedur: [1.000.000]              │
│  ├ Obat:     Rp   800.000 │  ├ Obat:     [800.000]                │
│  ├ Kamar:    Rp   500.000 │  ├ Kamar:    [500.000]                │
│  └ Lainnya:  Rp   200.000 │  └ Lainnya:  [200.000]                │
│                            │                                        │
│  ⚠ Kode IM tersedia:      │                                        │
│  A09.0 → A09.0+1 (IM)     │                                        │
│                            │                                        │
├────────────────────────────┴────────────────────────────────────────┤
│ [Grouping iDRG]  [Simpan Draft]                    [Batal]         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Fitur 2: Integrasi E-Klaim Local Server

### Konsep

E-Klaim BPJS menggunakan **aplikasi desktop lokal** yang berjalan di jaringan RS. SIMRS akan berkomunikasi dengan server lokal ini melalui HTTP API sebelum data dikirim ke server BPJS pusat.

### Konfigurasi Koneksi

```env
# E-Klaim Local Server (aplikasi desktop BPJS yang berjalan di RS)
EKLAIM_LOCAL_URL=http://localhost:9091/api/eklaim
EKLAIM_LOCAL_TIMEOUT=30s

# Kredensial E-Klaim
EKLAIM_KODE_PPK=0301R001
EKLAIM_SECRET_KEY=your-secret-key-from-bpjs
EKLAIM_CODER_NIK=1234567890123456

# Mode: "local" (via local server) atau "direct" (langsung ke BPJS)
EKLAIM_MODE=local
```

### Service Layer: EKlaim Client

```go
// services/eklaim/client.go
package eklaim

type EKlaimClient struct {
    BaseURL   string
    KodePPK   string
    SecretKey string
    CoderNIK  string
    Timeout   time.Duration
}

// Method yang tersedia
type EKlaimClientInterface interface {
    // Klaim CRUD
    NewClaim(req NewClaimRequest) (*ClaimResponse, error)
    SetClaimData(req SetClaimDataRequest) (*ClaimResponse, error)
    DeleteClaim(noSEP string) (*ClaimResponse, error)
    GetClaimData(noSEP string) (*GetClaimDataResponse, error)

    // Grouping
    Grouper(noSEP string) (*GrouperResponse, error)

    // Finalisasi
    FinalClaim(noSEP string) (*FinalResponse, error)
    CancelClaim(noSEP string, reason string) (*CancelResponse, error)

    // Print & Status  
    ClaimPrint(noSEP string) (*PrintResponse, error)
    GetClaimStatus(req StatusRequest) (*StatusResponse, error)

    // Re-edit
    ReeditClaim(req ReeditRequest) (*ReeditResponse, error)

    // Health check
    Ping() error
}
```

### Request/Response Structs

```go
// Request ke E-Klaim Local Server
type EKlaimRequest struct {
    Metadata struct {
        Method string `json:"method"` // new_claim, set_claim_data, grouper, dll
    } `json:"metadata"`
    Data interface{} `json:"data"`
}

// Response dari E-Klaim Local Server
type EKlaimResponse struct {
    Metadata struct {
        Code    string `json:"code"`
        Message string `json:"message"`
    } `json:"metadata"`
    Response json.RawMessage `json:"response"`
}

// new_claim request data
type NewClaimData struct {
    NomorSEP         string  `json:"nomor_sep"`
    NomorKartu       string  `json:"nomor_kartu"`
    TglMasuk         string  `json:"tgl_masuk"`         // format: 2006-01-02
    TglPulang        string  `json:"tgl_pulang"`        // format: 2006-01-02
    CaraMasuk        string  `json:"cara_masuk"`        // 1=IGD, 2=Poli, 3=Rujukan, 4=Lahir
    JenisRawat       string  `json:"jenis_rawat"`       // 1=RI, 2=RJ
    KelasRawat       string  `json:"kelas_rawat"`       // 1, 2, 3
    DischargeStatus  string  `json:"discharge_status"`  // 1=Hidup, 2=Meninggal
    Diagnosa         string  `json:"diagnosa"`          // comma-separated ICD-10
    Procedure        string  `json:"procedure"`         // comma-separated ICD-9-CM
    DiagnosaINAGrouper string `json:"diagnosa_inagrouper"`
    ProcedureINAGrouper string `json:"procedure_inagrouper"`
    TarifRS          float64 `json:"tarif_rs"`
    CoderNIK         string  `json:"coder_nik"`
    // ICU fields
    ICUIndikator     string  `json:"icu_indikator"`
    ICULOS           string  `json:"icu_los"`
    VentilatorHour   string  `json:"ventilator_hour"`
    // Neonatus fields
    BirthWeight      string  `json:"birth_weight"`
    // Sub-acute / Chronic
    ADLSubAcute      string  `json:"adl_sub_acute"`
    ADLChronic       string  `json:"adl_chronic"`
}

// Grouper response
type GrouperResult struct {
    SEP            string  `json:"sep"`
    CBG            CBGInfo `json:"cbg"`
    HospitalTariff float64 `json:"hospital_tariff"`
    Difference     float64 `json:"difference"`
    GrouperVersion string  `json:"grouper_version"`
    DRGType        string  `json:"drg_type"` // "INA-CBG" atau "iDRG"
    SeverityLevel  string  `json:"severity_level"`
}

type CBGInfo struct {
    Code        string  `json:"code"`
    Description string  `json:"description"`
    Tariff      float64 `json:"tariff"`
    TariffBase  float64 `json:"tariff_base"`
    TopUpTariff float64 `json:"top_up_tariff"`
}
```

### Flow: Grouping via Local Server

```
┌──────────┐         ┌──────────────┐         ┌─────────────────┐
│  SIMRS   │         │   Backend    │         │ E-Klaim Local   │
│ Frontend │         │  (Go/Gin)    │         │    Server       │
└────┬─────┘         └──────┬───────┘         └───────┬─────────┘
     │                      │                         │
     │ 1. Klik "Grouping    │                         │
     │    iDRG"             │                         │
     │─────────────────────►│                         │
     │                      │                         │
     │                      │ 2. Validasi data        │
     │                      │    lokal (25 kriteria)  │
     │                      │                         │
     │                      │ 3. Cek apakah klaim     │
     │                      │    sudah ada di eklaim  │
     │                      │    local server         │
     │                      │────────────────────────►│
     │                      │   get_claim_data        │
     │                      │◄────────────────────────│
     │                      │                         │
     │                      │ 4a. Jika belum ada:     │
     │                      │     new_claim           │
     │                      │────────────────────────►│
     │                      │◄────────────────────────│
     │                      │                         │
     │                      │ 4b. Jika sudah ada:     │
     │                      │     set_claim_data      │
     │                      │────────────────────────►│
     │                      │◄────────────────────────│
     │                      │                         │
     │                      │ 5. Grouper              │
     │                      │────────────────────────►│
     │                      │◄────────────────────────│
     │                      │ (kode CBG + tarif)      │
     │                      │                         │
     │                      │ 6. Simpan hasil ke DB   │
     │                      │    + update state       │
     │                      │                         │
     │ 7. Response          │                         │
     │    (grouping result) │                         │
     │◄─────────────────────│                         │
     │                      │                         │
```

---

## Alur Kerja Lengkap

### Alur End-to-End

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     ALUR LENGKAP E-KLAIM (BARU)                         │
└─────────────────────────────────────────────────────────────────────────┘

[1. PASIEN PULANG / BILLING FINAL]
     │
     ▼
[2. DUPLIKASI RM → E-KLAIM DRAFT]
     │ • Petugas klik "Buat E-Klaim" dari halaman Visit/Billing
     │ • Sistem otomatis menduplikasi: diagnosis, prosedur, tarif
     │ • Data duplikasi BISA DIEDIT
     │ • Tampilan: Split view (RM Asli | Data Klaim)
     │
     │ State: DRAFT
     ▼
[3. KODER REVIEW & EDIT DATA KLAIM]
     │ • Review diagnosis → ganti ke kode IM jika perlu
     │ • Review prosedur → tambah multiplicity & setting
     │ • Review tarif RS
     │ • Perbandingan dengan RM asli selalu terlihat
     │
     │ State: DRAFT (masih bisa edit)
     ▼
[4. SINKRONISASI KE E-KLAIM LOCAL SERVER]
     │ • Sistem kirim new_claim / set_claim_data ke local server
     │ • Validasi 25 kriteria sebelum kirim
     │ • Log request/response
     │
     │ State: DRAFT → SYNCED (opsional state baru)
     ▼
[5. GROUPING iDRG (via Local Server)]
     │ • POST grouper ke local server
     │ • Terima: kode iDRG + tarif
     │ • Simpan hasil ke eklaim record
     │
     │ State: IDRG_GROUPED
     ▼
[6. FINAL iDRG]
     │ • Jika grouping valid → tombol Final muncul
     │ • Jika error → harus edit ulang (kembali ke step 3)
     │ • Setelah final: form input LOCKED
     │
     │ State: IDRG_FINAL
     ▼
[7. IMPORT CODING iDRG → INACBG]
     │ • Salin diagnosis+prosedur dari iDRG ke INACBG
     │ • Warning untuk kode IM yang tidak valid di INACBG
     │ • Koder bisa edit coding INACBG secara terpisah
     │
     │ State: IDRG_FINAL (belum berubah)
     ▼
[8. GROUPING INACBG (via Local Server)]
     │ • POST grouper ke local server  
     │ • Terima: kode INACBG + tarif
     │
     │ State: INACBG_GROUPED
     ▼
[9. FINAL INACBG]
     │ State: INACBG_FINAL
     ▼
[10. FINAL KLAIM]
     │ • POST claim_final ke local server
     │ State: CLAIM_FINAL
     ▼
[11. KIRIM KLAIM]
     │ • Local server sinkron ke BPJS pusat (otomatis)
     │ State: SENT
     ▼
[12. MONITORING & VERIFIKASI]
     │ • GET get_claim_status dari local server
     │ • Update status: LAYAK / TIDAK_LAYAK
     │ State: VERIFIED / DISPUTED / REJECTED
```

---

## Database Schema (Migrasi)

### Tabel Baru: `eklaim_rm_snapshots`

Menyimpan snapshot RM asli saat duplikasi dilakukan.

```sql
CREATE TABLE eklaim_rm_snapshots (
    id              SERIAL PRIMARY KEY,
    created_at      TIMESTAMP DEFAULT NOW(),

    eklaim_id       INTEGER NOT NULL REFERENCES eklaims(id),
    visit_id        INTEGER NOT NULL REFERENCES visits(id),

    -- Snapshot data asli (JSON)
    diagnoses_json  TEXT,          -- JSON array diagnosis asli
    procedures_json TEXT,          -- JSON array prosedur asli
    tarif_json      TEXT,          -- JSON object tarif asli dari billing
    patient_json    TEXT,          -- JSON patient data saat duplikasi
    sep_json        TEXT,          -- JSON SEP data saat duplikasi

    -- Metadata
    duplicated_by   INTEGER REFERENCES users(id),
    notes           TEXT
);

CREATE INDEX idx_eklaim_rm_snapshots_eklaim ON eklaim_rm_snapshots(eklaim_id);
CREATE INDEX idx_eklaim_rm_snapshots_visit ON eklaim_rm_snapshots(visit_id);
```

### Modifikasi Tabel: `eklaims`

```sql
-- Tambahan kolom untuk tracking duplikasi dan local server
ALTER TABLE eklaims ADD COLUMN duplicated_from_visit_id INTEGER REFERENCES visits(id);
ALTER TABLE eklaims ADD COLUMN duplicated_at TIMESTAMP;
ALTER TABLE eklaims ADD COLUMN duplicated_by_id INTEGER REFERENCES users(id);

-- Local server tracking
ALTER TABLE eklaims ADD COLUMN local_claim_id VARCHAR(50);       -- Claim ID dari local server
ALTER TABLE eklaims ADD COLUMN local_server_synced BOOLEAN DEFAULT FALSE;
ALTER TABLE eklaims ADD COLUMN local_server_synced_at TIMESTAMP;
ALTER TABLE eklaims ADD COLUMN local_server_last_error TEXT;

-- Kelas rawat (dibutuhkan oleh E-Klaim API)
ALTER TABLE eklaims ADD COLUMN kelas_rawat VARCHAR(5);

-- Coder NIK
ALTER TABLE eklaims ADD COLUMN coder_nik VARCHAR(20);

-- Index
CREATE INDEX idx_eklaims_duplicated_visit ON eklaims(duplicated_from_visit_id);
CREATE INDEX idx_eklaims_local_claim ON eklaims(local_claim_id);
```

### Tabel Baru: `eklaim_local_server_logs`

Log semua komunikasi dengan E-Klaim local server.

```sql
CREATE TABLE eklaim_local_server_logs (
    id              SERIAL PRIMARY KEY,
    created_at      TIMESTAMP DEFAULT NOW(),

    eklaim_id       INTEGER REFERENCES eklaims(id),
    
    -- Request
    method          VARCHAR(50) NOT NULL,     -- new_claim, grouper, claim_final, dll
    request_url     VARCHAR(500),
    request_body    TEXT,
    request_headers TEXT,

    -- Response
    response_code   VARCHAR(10),
    response_body   TEXT,
    response_time_ms INTEGER,                 -- Waktu response dalam milidetik

    -- Status
    is_success      BOOLEAN DEFAULT FALSE,
    error_message   TEXT,

    -- User
    triggered_by    INTEGER REFERENCES users(id)
);

CREATE INDEX idx_eklaim_local_logs_eklaim ON eklaim_local_server_logs(eklaim_id);
CREATE INDEX idx_eklaim_local_logs_method ON eklaim_local_server_logs(method);
CREATE INDEX idx_eklaim_local_logs_created ON eklaim_local_server_logs(created_at);
```

---

## API Endpoints (Backend)

### Endpoints Baru

| Method | Endpoint | Deskripsi | Permission |
|--------|----------|-----------|------------|
| `POST` | `/api/eklaim/duplicate-from-visit` | Duplikasi RM → E-Klaim Draft | `eklaim.create` |
| `GET` | `/api/eklaim/:id/original-rm` | Ambil snapshot RM asli untuk perbandingan | `eklaim.view` |
| `GET` | `/api/eklaim/:id/diff` | Bandingkan data klaim vs RM asli | `eklaim.view` |
| `POST` | `/api/eklaim/:id/sync-local` | Sinkronisasi ke E-Klaim local server | `eklaim.grouping` |
| `POST` | `/api/eklaim/:id/grouping-idrg-live` | Grouping iDRG via local server | `eklaim.grouping` |
| `POST` | `/api/eklaim/:id/grouping-inacbg-live` | Grouping INACBG via local server | `eklaim.grouping` |
| `POST` | `/api/eklaim/:id/final-claim-live` | Finalisasi via local server | `eklaim.final` |
| `POST` | `/api/eklaim/:id/cancel-claim-live` | Batalkan finalisasi via local server | `eklaim.final` |
| `GET` | `/api/eklaim/:id/claim-data-live` | Ambil data klaim dari local server | `eklaim.view` |
| `GET` | `/api/eklaim/:id/claim-print-live` | Cetak resume dari local server | `eklaim.view` |
| `GET` | `/api/eklaim/status-live` | Status verifikasi dari local server | `eklaim.view` |
| `GET` | `/api/eklaim/local-server/health` | Health check local server | `eklaim.view` |
| `GET` | `/api/eklaim/:id/local-logs` | Log komunikasi local server | `eklaim.view` |

### Modifikasi Endpoints Existing

| Endpoint | Perubahan |
|----------|-----------|
| `POST /api/eklaim/:id/grouping-idrg` | Sekarang memanggil local server instead of simulasi |
| `POST /api/eklaim/:id/grouping-inacbg` | Sekarang memanggil local server instead of simulasi |
| `POST /api/eklaim/:id/send-claim` | Sekarang memanggil `claim_final` di local server |

---

## Implementasi Backend (Go)

### Struktur File Baru

```
backend/
├── services/
│   └── eklaim/
│       ├── client.go          # HTTP client untuk E-Klaim local server
│       ├── client_test.go     # Unit tests
│       ├── types.go           # Request/Response struct
│       ├── signature.go       # HMAC signature generation
│       └── errors.go          # Error types
├── handlers/
│   ├── eklaim.go              # (existing) — modifikasi grouping
│   └── eklaim_local.go        # (new) — handler untuk local server endpoints
├── models/
│   ├── eklaim.go              # (modify) — tambah field duplikasi & local server
│   └── eklaim_snapshot.go     # (new) — model snapshot RM
└── migrations/
    └── xxx_eklaim_local_server.go  # Migrasi DB
```

### Service: E-Klaim Client (`services/eklaim/client.go`)

```go
package eklaim

import (
    "bytes"
    "crypto/hmac"
    "crypto/sha256"
    "encoding/base64"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "time"
)

type Client struct {
    baseURL    string
    kodePPK    string
    secretKey  string
    coderNIK   string
    httpClient *http.Client
}

func NewClient(baseURL, kodePPK, secretKey, coderNIK string, timeout time.Duration) *Client {
    return &Client{
        baseURL:   baseURL,
        kodePPK:   kodePPK,
        secretKey: secretKey,
        coderNIK:  coderNIK,
        httpClient: &http.Client{
            Timeout: timeout,
        },
    }
}

// generateSignature creates HMAC-SHA256 signature
func (c *Client) generateSignature() (string, int64) {
    timestamp := time.Now().Unix()
    data := fmt.Sprintf("%s&%d", c.kodePPK, timestamp)
    h := hmac.New(sha256.New, []byte(c.secretKey))
    h.Write([]byte(data))
    signature := base64.StdEncoding.EncodeToString(h.Sum(nil))
    return signature, timestamp
}

// doRequest sends request to E-Klaim local server
func (c *Client) doRequest(method string, data interface{}) (*EKlaimResponse, error) {
    reqBody := EKlaimRequest{
        Metadata: struct {
            Method string `json:"method"`
        }{Method: method},
        Data: data,
    }

    jsonBody, err := json.Marshal(reqBody)
    if err != nil {
        return nil, fmt.Errorf("marshal request: %w", err)
    }

    req, err := http.NewRequest("POST", c.baseURL, bytes.NewReader(jsonBody))
    if err != nil {
        return nil, fmt.Errorf("create request: %w", err)
    }

    // Set headers
    signature, timestamp := c.generateSignature()
    req.Header.Set("Content-Type", "application/json; charset=utf-8")
    req.Header.Set("X-Cons-Id", c.kodePPK)
    req.Header.Set("X-Timestamp", fmt.Sprintf("%d", timestamp))
    req.Header.Set("X-Signature", signature)

    resp, err := c.httpClient.Do(req)
    if err != nil {
        return nil, fmt.Errorf("send request: %w", err)
    }
    defer resp.Body.Close()

    body, err := io.ReadAll(resp.Body)
    if err != nil {
        return nil, fmt.Errorf("read response: %w", err)
    }

    var result EKlaimResponse
    if err := json.Unmarshal(body, &result); err != nil {
        return nil, fmt.Errorf("unmarshal response: %w", err)
    }

    if result.Metadata.Code != "200" {
        return &result, fmt.Errorf("eklaim error [%s]: %s", 
            result.Metadata.Code, result.Metadata.Message)
    }

    return &result, nil
}

// Ping checks if local server is reachable
func (c *Client) Ping() error {
    _, err := http.Get(c.baseURL)
    return err
}

// NewClaim creates a new claim on local server
func (c *Client) NewClaim(data NewClaimData) (*EKlaimResponse, error) {
    data.CoderNIK = c.coderNIK
    return c.doRequest("new_claim", data)
}

// SetClaimData updates claim data on local server
func (c *Client) SetClaimData(data SetClaimDataRequest) (*EKlaimResponse, error) {
    data.CoderNIK = c.coderNIK
    return c.doRequest("set_claim_data", data)
}

// Grouper performs INA-CBG grouping
func (c *Client) Grouper(noSEP string) (*EKlaimResponse, error) {
    return c.doRequest("grouper", map[string]string{"nomor_sep": noSEP})
}

// FinalClaim sends claim for finalization
func (c *Client) FinalClaim(noSEP string) (*EKlaimResponse, error) {
    return c.doRequest("claim_final", map[string]string{
        "nomor_sep": noSEP,
        "coder_nik": c.coderNIK,
    })
}

// CancelClaim cancels a finalized claim
func (c *Client) CancelClaim(noSEP, reason string) (*EKlaimResponse, error) {
    return c.doRequest("claim_cancel", map[string]string{
        "nomor_sep": noSEP,
        "reason":    reason,
    })
}

// GetClaimData retrieves claim data from local server
func (c *Client) GetClaimData(noSEP string) (*EKlaimResponse, error) {
    return c.doRequest("get_claim_data", map[string]string{"nomor_sep": noSEP})
}

// DeleteClaim deletes a claim from local server
func (c *Client) DeleteClaim(noSEP string) (*EKlaimResponse, error) {
    return c.doRequest("delete_claim", map[string]string{"nomor_sep": noSEP})
}

// ClaimPrint gets print data
func (c *Client) ClaimPrint(noSEP string) (*EKlaimResponse, error) {
    return c.doRequest("claim_print", map[string]string{"nomor_sep": noSEP})
}

// GetClaimStatus gets verification status
func (c *Client) GetClaimStatus(req StatusRequest) (*EKlaimResponse, error) {
    return c.doRequest("get_claim_status", req)
}
```

### Handler: Duplikasi RM (`handlers/eklaim_local.go`)

```go
// DuplicateFromVisit creates E-Klaim entry by duplicating medical record data
// POST /api/eklaim/duplicate-from-visit
func DuplicateFromVisit(c *gin.Context) {
    var input struct {
        VisitID           uint `json:"visit_id" binding:"required"`
        IncludeDiagnoses  bool `json:"include_diagnoses"`
        IncludeProcedures bool `json:"include_procedures"`
        IncludeTarif      bool `json:"include_tarif"`
    }

    if err := c.ShouldBindJSON(&input); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }

    // 1. Load visit with all related data
    var visit models.Visit
    if err := database.DB.
        Preload("Registration").
        Preload("Registration.Patient").
        Preload("SEP").
        Preload("Room").
        Preload("Doctor").
        First(&visit, input.VisitID).Error; err != nil {
        c.JSON(404, gin.H{"error": "Visit tidak ditemukan"})
        return
    }

    // 2. Check if E-Klaim already exists
    var existing models.EKlaim
    if err := database.DB.Where("visit_id = ?", input.VisitID).First(&existing).Error; err == nil {
        c.JSON(409, gin.H{
            "error":     "E-Klaim sudah ada untuk visit ini",
            "eklaim_id": existing.ID,
        })
        return
    }

    // 3. Load diagnosis dari rekam medis
    var diagnoses []models.Diagnosis
    database.DB.Where("visit_id = ?", input.VisitID).
        Order("type ASC, created_at ASC").Find(&diagnoses)

    // 4. Load prosedur dari rekam medis  
    var procedures []models.VisitProcedure
    database.DB.Where("visit_id = ?", input.VisitID).
        Order("created_at ASC").Find(&procedures)

    // 5. Load billing data
    var billing models.Billing
    database.DB.Where("visit_id = ?", input.VisitID).First(&billing)

    // 6. Build E-Klaim entry
    userID := getUserIDFromContext(c)
    now := time.Now()

    eklaim := models.EKlaim{
        VisitID:               input.VisitID,
        State:                 models.ClaimStateDraft,
        DuplicatedFromVisitID: &input.VisitID,
        DuplicatedAt:          &now,
        DuplicatedByID:        userID,
    }

    // Populate dari SEP
    if visit.SEP != nil {
        eklaim.NoSEP = visit.SEP.NoSEP
        eklaim.NoKartu = visit.SEP.NoKartu
    }

    // Populate dari Patient
    if visit.Registration != nil && visit.Registration.Patient != nil {
        patient := visit.Registration.Patient
        eklaim.TglLahir = patient.DateOfBirth
        eklaim.JenisKelamin = patient.Gender
    }

    // Populate dari Visit
    eklaim.TglMasuk = visit.CheckInTime
    if visit.DischargeTime != nil {
        eklaim.TglPulang = visit.DischargeTime
    } else {
        eklaim.TglPulang = visit.EndTime
    }
    eklaim.LOS = visit.InpatientDays

    // Map visit type to jenis rawat
    switch visit.VisitType {
    case "inpatient":
        eklaim.JenisRawat = models.JenisRawatInap
    case "outpatient":
        eklaim.JenisRawat = models.JenisRawatJalan
    case "emergency":
        eklaim.JenisRawat = models.JenisRawatIGD
    }

    // Populate tarif dari billing
    if input.IncludeTarif {
        eklaim.TarifRS = billing.TotalAmount
        // Breakdown tarif bisa disesuaikan dari billing items
    }

    // 7. Save E-Klaim
    tx := database.DB.Begin()

    if err := tx.Create(&eklaim).Error; err != nil {
        tx.Rollback()
        c.JSON(500, gin.H{"error": "Gagal membuat E-Klaim"})
        return
    }

    // 8. Duplikasi diagnosis ke eklaim_diagnoses
    if input.IncludeDiagnoses {
        for i, diag := range diagnoses {
            eklaimDiag := models.EKlaimDiagnosis{
                EKlaimID:  eklaim.ID,
                Code:      diag.ICD10Code,
                Name:      diag.ICD10Name,
                IsPrimary: diag.Type == "primary",
                Source:    "idrg",
                Sequence:  i + 1,
            }
            tx.Create(&eklaimDiag)
        }
    }

    // 9. Duplikasi prosedur ke eklaim_procedures
    if input.IncludeProcedures {
        for i, proc := range procedures {
            eklaimProc := models.EKlaimProcedure{
                EKlaimID:     eklaim.ID,
                Code:         proc.ICD9Code,
                Name:         proc.Name,
                Multiplicity: 1,
                Setting:      models.ProcedureSettingNonOR,
                Source:       "idrg",
                Sequence:     i + 1,
            }
            tx.Create(&eklaimProc)
        }
    }

    // 10. Simpan snapshot RM asli
    diagJSON, _ := json.Marshal(diagnoses)
    procJSON, _ := json.Marshal(procedures)
    tarifJSON, _ := json.Marshal(billing)

    snapshot := models.EKlaimRMSnapshot{
        EKlaimID:       eklaim.ID,
        VisitID:        input.VisitID,
        DiagnosesJSON:  string(diagJSON),
        ProceduresJSON: string(procJSON),
        TarifJSON:      string(tarifJSON),
        DuplicatedBy:   userID,
    }
    tx.Create(&snapshot)

    tx.Commit()

    // 11. Log
    logEKlaimAction(eklaim.ID, userID, "DUPLICATE_FROM_RM", "",
        string(eklaim.State), "Duplikasi RM dari Visit #"+fmt.Sprint(input.VisitID),
        c.ClientIP())

    // 12. Reload with all data
    database.DB.
        Preload("Diagnoses").
        Preload("Procedures").
        Preload("Visit.Registration.Patient").
        First(&eklaim, eklaim.ID)

    c.JSON(201, gin.H{
        "data":    eklaim,
        "buttons": eklaim.GetButtonVisibility(),
        "message": "E-Klaim berhasil dibuat dari duplikasi RM",
    })
}
```

---

## Implementasi Frontend (React)

### Halaman Baru

| Route | Komponen | Deskripsi |
|-------|----------|-----------|
| `/eklaim` | `EKlaimList` | Daftar semua E-Klaim (existing, modifikasi) |
| `/eklaim/new?visit_id=123` | `EKlaimForm` | Form E-Klaim baru dengan duplikasi RM |
| `/eklaim/:id` | `EKlaimDetail` | Detail E-Klaim dengan split view |
| `/eklaim/:id/compare` | `EKlaimCompare` | Full comparison RM vs Klaim |
| `/eklaim/monitoring` | `EKlaimMonitoring` | Dashboard monitoring status klaim |

### Komponen UI Utama

```
EKlaimDetail
├── EKlaimHeader              # Info pasien, SEP, status badge
├── EKlaimSplitView           # Split RM Asli (kiri) | Data Klaim (kanan)
│   ├── OriginalRMPanel       # Read-only panel data RM asli
│   │   ├── DiagnosisList     # Diagnosis dari RM
│   │   ├── ProcedureList     # Prosedur dari RM
│   │   └── TarifSummary      # Ringkasan tarif billing
│   │
│   └── ClaimDataPanel        # Editable panel data klaim
│       ├── DiagnosisEditor   # Edit diagnosis + cari kode IM
│       ├── ProcedureEditor   # Edit prosedur + multiplicity + setting
│       ├── TarifEditor       # Edit breakdown tarif
│       └── DiffIndicator     # Highlight perbedaan dengan RM asli
│
├── IDRGSection               # Grouping iDRG + result
│   ├── GroupingResult        # Kode + tarif iDRG
│   └── ActionButtons         # [Grouping] [Final] [Edit Ulang]
│
├── INACBGSection             # Muncul setelah iDRG Final
│   ├── ImportButton          # [Import dari iDRG]
│   ├── GroupingResult        # Kode + tarif INACBG
│   └── ActionButtons
│
├── ClaimActions              # [Final Klaim] [Kirim] [Cetak]
│
├── LocalServerStatus         # Status koneksi local server (hijau/merah)
│   └── SyncIndicator         # Synced / Not synced / Error
│
└── ActivityLog               # Timeline log aktivitas
```

### Split View Mockup

```
┌────────────────────────────────────────────────────────────────────────┐
│  E-Klaim #56                         Status: [🟡 DRAFT]              │
│  SEP: 0301R0011124010001             Local Server: [🟢 Connected]    │
│  Pasien: JOHN DOE (L/44th)           Last Sync: 10:30 WIB           │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌─── RM ASLI (Read-Only) ────┐  ┌─── DATA KLAIM (Editable) ────┐   │
│  │                            │  │                                │   │
│  │ Diagnosis:                 │  │ Diagnosis iDRG:                │   │
│  │ 🔵 [P] A09.0              │  │ 🔵 [P] A09.0          [✏️][🗑] │   │
│  │     Gastroenteritis        │  │     Gastroenteritis            │   │
│  │ ⚪ [S] E11.9              │  │ ⚪ [S] E11.9          [✏️][🗑] │   │
│  │     DM Tipe 2             │  │     DM Tipe 2                  │   │
│  │                            │  │ [+ Tambah Diagnosis]           │   │
│  │                            │  │                                │   │
│  │ Prosedur:                  │  │ Prosedur iDRG:                 │   │
│  │ • 99.29 - Injeksi infus   │  │ • 99.29 - Injeksi     [✏️][🗑] │   │
│  │                            │  │   Mult: [1] Set: [NON_OR]     │   │
│  │                            │  │ [+ Tambah Prosedur]            │   │
│  │                            │  │                                │   │
│  │ Tarif Billing:             │  │ Tarif RS:                      │   │
│  │ Total: Rp 2.500.000       │  │ Prosedur: [1.000.000]          │   │
│  │ ├ Tindakan: 1.000.000     │  │ Alkes:    [0]                  │   │
│  │ ├ Obat: 800.000           │  │ Obat:     [800.000]            │   │
│  │ ├ Kamar: 500.000          │  │ Kamar:    [500.000]            │   │
│  │ └ Lainnya: 200.000        │  │ Lainnya:  [200.000]            │   │
│  │                            │  │ Total:    Rp 2.500.000         │   │
│  └────────────────────────────┘  └────────────────────────────────┘   │
│                                                                        │
│  ┌═══════════════════════════════════════════════════════════════════┐ │
│  │  iDRG GROUPING                                                   │ │
│  │                                                                   │ │
│  │  Belum dilakukan grouping                                        │ │
│  │                                                                   │ │
│  │  [🔄 Grouping iDRG]  [💾 Simpan Draft]                          │ │
│  └═══════════════════════════════════════════════════════════════════┘ │
│                                                                        │
│  ┌═══════════════════════════════════════════════════════════════════┐ │
│  │  ACTIVITY LOG                                                     │ │
│  │  • 10:30 — E-Klaim dibuat dari duplikasi RM (oleh: Admin)       │ │
│  │  • 10:30 — 2 diagnosis diduplikasi                               │ │
│  │  • 10:30 — 1 prosedur diduplikasi                                │ │
│  └═══════════════════════════════════════════════════════════════════┘ │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Konfigurasi

### Environment Variables Baru

```env
# === E-Klaim Local Server ===
# URL aplikasi E-Klaim desktop BPJS yang berjalan di jaringan RS
EKLAIM_LOCAL_URL=http://localhost:9091/api/eklaim

# Timeout koneksi ke local server (default: 30s)
EKLAIM_LOCAL_TIMEOUT=30s

# Kredensial E-Klaim dari BPJS
EKLAIM_KODE_PPK=0301R001
EKLAIM_SECRET_KEY=your-secret-key-from-bpjs

# NIK Koder (default, bisa di-override per user)
EKLAIM_CODER_NIK=1234567890123456

# Mode operasi:
# - "local"    : via E-Klaim local server (RECOMMENDED)
# - "direct"   : langsung ke server BPJS (untuk testing)
# - "simulate" : mode simulasi tanpa real API (development)
EKLAIM_MODE=local

# === E-Klaim Direct Server (jika mode=direct) ===
EKLAIM_DIRECT_URL=https://dvlp.bpjs-kesehatan.go.id:9081/api/eklaim
```

### Tambahan di `config/config.go`

```go
type EKlaimConfig struct {
    LocalURL    string
    DirectURL   string
    KodePPK     string
    SecretKey   string
    CoderNIK    string
    Mode        string        // "local", "direct", "simulate"
    Timeout     time.Duration
}

func LoadEKlaimConfig() *EKlaimConfig {
    timeout, _ := time.ParseDuration(getEnv("EKLAIM_LOCAL_TIMEOUT", "30s"))
    return &EKlaimConfig{
        LocalURL:  getEnv("EKLAIM_LOCAL_URL", "http://localhost:9091/api/eklaim"),
        DirectURL: getEnv("EKLAIM_DIRECT_URL", ""),
        KodePPK:   getEnv("EKLAIM_KODE_PPK", ""),
        SecretKey: getEnv("EKLAIM_SECRET_KEY", ""),
        CoderNIK:  getEnv("EKLAIM_CODER_NIK", ""),
        Mode:      getEnv("EKLAIM_MODE", "simulate"),
        Timeout:   timeout,
    }
}
```

---

## Tahapan Implementasi

### Fase 1: Duplikasi RM (1-2 minggu)

| No | Task | File | Prioritas |
|----|------|------|-----------|
| 1 | Buat migrasi DB (tabel + kolom baru) | `migrations/xxx_eklaim_rm.go` | P0 |
| 2 | Model `EKlaimRMSnapshot` | `models/eklaim_snapshot.go` | P0 |
| 3 | Update model `EKlaim` (field baru) | `models/eklaim.go` | P0 |
| 4 | Handler `DuplicateFromVisit` | `handlers/eklaim_local.go` | P0 |
| 5 | Handler `GetOriginalRM` | `handlers/eklaim_local.go` | P1 |
| 6 | Handler `GetRMDiff` | `handlers/eklaim_local.go` | P1 |
| 7 | Register routes | `routes/eklaim.go` | P0 |
| 8 | Frontend: Split View component | `src/pages/eklaim/` | P0 |
| 9 | Frontend: Diagnosis Editor | `src/components/eklaim/` | P0 |
| 10 | Frontend: Procedure Editor | `src/components/eklaim/` | P0 |

### Fase 2: E-Klaim Local Server Integration (2-3 minggu)

| No | Task | File | Prioritas |
|----|------|------|-----------|
| 1 | Config E-Klaim | `config/config.go` | P0 |
| 2 | Service: E-Klaim Client | `services/eklaim/client.go` | P0 |
| 3 | Service: Signature generation | `services/eklaim/signature.go` | P0 |
| 4 | Service: Type definitions | `services/eklaim/types.go` | P0 |
| 5 | Handler: Sync to local | `handlers/eklaim_local.go` | P0 |
| 6 | Handler: Grouping iDRG live | `handlers/eklaim_local.go` | P0 |
| 7 | Handler: Grouping INACBG live | `handlers/eklaim_local.go` | P0 |
| 8 | Handler: Final claim live | `handlers/eklaim_local.go` | P0 |
| 9 | Handler: Health check | `handlers/eklaim_local.go` | P1 |
| 10 | Migrasi: Local server logs table | `migrations/xxx_eklaim_local.go` | P0 |
| 11 | Replace simulasi di GroupingIDRG | `handlers/eklaim.go` | P0 |
| 12 | Replace simulasi di GroupingINACBG | `handlers/eklaim.go` | P0 |
| 13 | Frontend: Local server status | `src/components/eklaim/` | P1 |
| 14 | Frontend: Monitoring dashboard | `src/pages/eklaim/` | P1 |

### Fase 3: Polish & Testing (1 minggu)

| No | Task | Prioritas |
|----|------|-----------|
| 1 | Unit tests E-Klaim Client | P0 |
| 2 | Integration test dengan mock server | P0 |
| 3 | Validasi 25 kriteria KEMENKES | P0 |
| 4 | Error handling & retry logic | P1 |
| 5 | Logging & monitoring | P1 |
| 6 | Dokumentasi user guide | P2 |

---

## Catatan Teknis

### 1. Idempotency
Setiap operasi ke local server harus **idempotent**. Jika `new_claim` gagal di tengah jalan, bisa di-retry tanpa duplikasi. Gunakan `no_sep` sebagai unique identifier.

### 2. Offline Handling
Jika local server tidak tersedia:
- Tampilkan warning di UI ("Local server tidak terhubung")
- Data tetap bisa disimpan sebagai DRAFT di SIMRS
- Sinkronisasi dilakukan manual saat server kembali online

### 3. Data Consistency
- RM asli **TIDAK PERNAH** diubah oleh proses E-Klaim
- Snapshot RM asli disimpan saat duplikasi (immutable)
- Setiap perubahan di data klaim di-log

### 4. Security
- Signature di-generate per request (tidak di-cache)
- Secret key disimpan di environment variable
- Log tidak menyimpan secret key
