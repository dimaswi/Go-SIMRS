# Rancangan Implementasi APLICARE & ICARE pada SIMRS

> **Tanggal:** 17 Februari 2026  
> **Status:** Draft Rancangan  
> **Referensi Codebase:** Go-SIMRS (Go + Gin + GORM backend, React + TypeScript frontend)

---

## Daftar Isi
1. [Gambaran Umum](#1-gambaran-umum)
2. [APLICARE - Rancangan Implementasi](#2-aplicare---rancangan-implementasi)
3. [ICARE - Rancangan Implementasi](#3-icare---rancangan-implementasi)
4. [Desain Database (Model)](#4-desain-database-model)
5. [Desain API (Backend)](#5-desain-api-backend)
6. [Desain UX (Frontend)](#6-desain-ux-frontend)
7. [Integrasi dengan Fitur Existing](#7-integrasi-dengan-fitur-existing)
8. [Tahapan Implementasi](#8-tahapan-implementasi)

---

## 1. Gambaran Umum

### 1.1 Apa itu APLICARE?
**APLICARE** (Aplikasi Pelayanan Informasi dan Ketersediaan Tempat Tidur) adalah aplikasi BPJS Kesehatan untuk monitoring ketersediaan tempat tidur di rumah sakit secara real-time. RS wajib melaporkan:
- Jumlah total tempat tidur per ruangan/kelas
- Jumlah tempat tidur terisi (occupied)
- Jumlah tempat tidur kosong (available)
- Update real-time setiap ada perubahan (admission/discharge/transfer)

**Endpoint APLICARE:**
| Method | Endpoint | Fungsi |
|--------|----------|--------|
| `POST` | `/api/aplicares/update_tempat_tidur` | Update ketersediaan TT |
| `GET` | `/api/aplicares/get_data_ruangan/{kode_ppk}` | Get data ruangan RS |
| `POST` | `/api/aplicares/create_ruangan` | Create/register ruangan baru |
| `PUT` | `/api/aplicares/update_ruangan` | Update info ruangan |
| `DELETE` | `/api/aplicares/delete_ruangan/{kode_ruangan}` | Hapus ruangan |

### 1.2 Apa itu ICARE?
**ICARE** (Informed Consent Application for Healthcare) / **I-Care BPJS** adalah sistem bridging data primer kesehatan peserta BPJS. RS mengirimkan:
- Data kunjungan/encounter
- Data diagnosis (ICD-10)
- Data tindakan/prosedur (ICD-9-CM)
- Data hasil pemeriksaan (vital signs, lab results)
- Data resep/obat

**Endpoint I-Care:**
| Method | Endpoint | Fungsi |
|--------|----------|--------|
| `POST` | `/api/icare/send_kunjungan` | Kirim data kunjungan |
| `POST` | `/api/icare/send_diagnosa` | Kirim data diagnosa |
| `POST` | `/api/icare/send_prosedur` | Kirim data prosedur |
| `POST` | `/api/icare/send_pemeriksaan` | Kirim data pemeriksaan |
| `POST` | `/api/icare/send_resep` | Kirim data resep obat |
| `GET` | `/api/icare/get_kunjungan/{no_sep}` | Get data kunjungan |

### 1.3 Kondisi SIMRS Saat Ini

**Yang sudah ada:**
- ✅ Integrasi BPJS Antrian Online (Antrean/Mobile JKN)
- ✅ Integrasi BPJS VClaim (SEP, Surat Kontrol, SPRI, Rujukan)
- ✅ Integrasi E-Klaim
- ✅ Integrasi SatuSehat
- ✅ Model `IntegrationConfig` dengan tipe `bpjs-icare` sudah terdaftar
- ✅ Model Building → Room → RoomUnit → Bed (hierarki lengkap)
- ✅ Model Visit dengan `BedID`, `InpatientClass`, `AdmissionTime`, `DischargeTime`
- ✅ Model `AdmissionRequest` untuk permintaan rawat inap
- ✅ Floor plan management (Building → Room → RoomUnit → Bed dengan koordinat)
- ✅ `ComputeBedStats()` sudah menghitung total & available beds per room
- ✅ Frontend: Halaman integrasi, building management, bed management

**Yang belum ada:**
- ❌ APLICARE client & service
- ❌ ICARE client & service
- ❌ Mapping ruangan SIMRS ↔ kode ruangan BPJS (APLICARE)
- ❌ Auto-sync bed availability ke APLICARE
- ❌ Auto-send kunjungan & data medis ke ICARE
- ❌ UI dashboard APLICARE & ICARE

---

## 2. APLICARE - Rancangan Implementasi

### 2.1 Konsep Mapping Ruangan

APLICARE membutuhkan mapping antara ruangan SIMRS dengan kode ruangan BPJS. Setiap Room yang `has_bed = true` & `service_type = "rawat_inap"` harus di-mapping ke kode ruangan APLICARE BPJS.

```
SIMRS Structure:         APLICARE BPJS:
┌─────────────────┐      ┌────────────────────────┐
│ Building        │      │                        │
│ └─ Room         │ ───► │ Kode Ruangan BPJS      │
│    ├─ RoomUnit  │      │ ├─ Nama Ruangan        │
│    │  ├─ Bed 1  │      │ ├─ Kelas (1/2/3/VIP)   │
│    │  └─ Bed 2  │      │ ├─ Total TT            │
│    └─ RoomUnit  │      │ ├─ TT Terisi           │
│       ├─ Bed 3  │      │ └─ TT Kosong           │
│       └─ Bed 4  │      └────────────────────────┘
└─────────────────┘
```

### 2.2 Mekanisme Auto-Sync

APLICARE harus di-update secara **real-time** setiap ada event:

| Event di SIMRS | Aksi APLICARE |
|---------------|---------------|
| Pasien masuk rawat inap (admission) | `TT_terisi +1`, `TT_kosong -1` |
| Pasien keluar rawat inap (discharge) | `TT_terisi -1`, `TT_kosong +1` |
| Pasien pindah kamar (transfer) | Update 2 ruangan sekaligus |
| Bed ditambah/dihapus/maintenance | Update total TT ruangan |

**Trigger points di codebase existing:**
1. `handlers/admission_request.go` → `ProcessAdmissionRequest()` (saat assign bed)
2. `handlers/building.go` → `UpdateBed()` (saat status bed berubah)
3. Proses discharge visit rawat inap → bed status → `available`
4. Bed transfer → bed lama `available`, bed baru `occupied`

### 2.3 Flow APLICARE

```
┌─────────────────────────────────────────────────────────────┐
│                    ALUR APLICARE                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [SETUP AWAL - Sekali]                                       │
│  1. Admin setting config APLICARE di Integrasi               │
│  2. Admin mapping Room SIMRS → Kode Ruangan BPJS            │
│  3. Sync initial: kirim semua data ruangan ke APLICARE       │
│                                                              │
│  [OTOMATIS - Real-time]                                      │
│  4. Event admission → auto update APLICARE                   │
│  5. Event discharge → auto update APLICARE                   │
│  6. Event transfer  → auto update APLICARE                   │
│  7. Event bed maintenance → auto update APLICARE             │
│                                                              │
│  [MONITORING - Dashboard]                                    │
│  8. Dashboard real-time ketersediaan TT                      │
│  9. Riwayat sync & error log                                 │
│  10. Manual sync button (force update semua)                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. ICARE - Rancangan Implementasi

### 3.1 Konsep I-Care Bridging

I-Care mengirimkan data medis pasien BPJS setelah pelayanan selesai. Data dikirim per-visit yang memiliki SEP.

```
SIMRS Visit Data:             I-Care BPJS:
┌───────────────────┐         ┌─────────────────────┐
│ Visit             │         │ Kunjungan           │
│ ├─ SEP            │ ──────► │ ├─ No SEP           │
│ ├─ ICD-10 Codes   │ ──────► │ ├─ Diagnosa         │
│ ├─ ICD-9 Codes    │ ──────► │ ├─ Prosedur         │
│ ├─ Vital Signs    │ ──────► │ ├─ Pemeriksaan      │
│ ├─ Lab Results    │ ──────► │ │                    │
│ └─ Prescriptions  │ ──────► │ └─ Resep Obat       │
└───────────────────┘         └─────────────────────┘
```

### 3.2 Mekanisme Auto-Send

| Event di SIMRS | Aksi I-Care |
|---------------|-------------|
| Visit selesai (completed) + punya SEP | `send_kunjungan` |
| Diagnosis di-save (ICD-10) | `send_diagnosa` |
| Tindakan di-save (ICD-9-CM) | `send_prosedur` |
| Vital signs di-save | `send_pemeriksaan` |
| Resep di-buat | `send_resep` |

**Strategi pengiriman:** Batch send saat visit completed, retry otomatis jika gagal.

### 3.3 Flow I-Care

```
┌─────────────────────────────────────────────────────────────┐
│                      ALUR I-CARE                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [OTOMATIS - Saat visit selesai]                             │
│  1. Visit status → "completed"                               │
│  2. Cek apakah visit punya SEP                               │
│  3. Jika ada SEP:                                            │
│     a. Kirim data kunjungan (visit info)                     │
│     b. Kirim data diagnosa (ICD-10)                          │
│     c. Kirim data prosedur (ICD-9-CM)                        │
│     d. Kirim data pemeriksaan (vital signs + lab)            │
│     e. Kirim data resep (prescriptions)                      │
│  4. Catat status sync di database                            │
│                                                              │
│  [MANUAL - Dashboard]                                        │
│  5. List visit yang belum ter-sync                           │
│  6. Retry kirim individual/batch                             │
│  7. Riwayat sync & error log                                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Desain Database (Model)

### 4.1 Model APLICARE (Baru)

```go
// File: backend/models/aplicare.go

// AplicareRoomMapping maps SIMRS rooms to BPJS APLICARE room codes
type AplicareRoomMapping struct {
    ID        uint           `gorm:"primarykey" json:"id"`
    CreatedAt time.Time      `json:"created_at"`
    UpdatedAt time.Time      `json:"updated_at"`
    DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

    // SIMRS Room
    RoomID   uint   `gorm:"not null;uniqueIndex" json:"room_id"`
    RoomCode string `gorm:"size:20" json:"room_code"`  // Cache: room code SIMRS
    RoomName string `gorm:"size:100" json:"room_name"` // Cache: room name SIMRS

    // BPJS APLICARE
    KodeRuanganBPJS string `gorm:"not null;size:20;uniqueIndex" json:"kode_ruangan_bpjs"` // Kode ruangan di APLICARE
    NamaRuanganBPJS string `gorm:"size:100" json:"nama_ruangan_bpjs"`                     // Nama ruangan di APLICARE
    KelasRuangan    string `gorm:"size:10;not null" json:"kelas_ruangan"`                  // 1, 2, 3, vip, vvip, icu

    IsActive bool `gorm:"default:true" json:"is_active"`

    // Relations
    Room *Room `gorm:"foreignKey:RoomID" json:"room,omitempty"`
}

// AplicareSyncLog stores APLICARE sync events
type AplicareSyncLog struct {
    ID        uint      `gorm:"primarykey" json:"id"`
    CreatedAt time.Time `json:"created_at"`

    // Mapping Reference
    RoomMappingID uint   `gorm:"not null;index" json:"room_mapping_id"`
    KodeRuangan   string `gorm:"size:20;index" json:"kode_ruangan"`

    // Event
    EventType string `gorm:"size:30;not null;index" json:"event_type"` // admission, discharge, transfer, manual_sync, bed_update

    // Data Sent
    TotalTT  int `json:"total_tt"`
    TTTerisi int `json:"tt_terisi"`
    TTKosong int `json:"tt_kosong"`

    // Sync Status
    Status       string `gorm:"size:20;default:'pending'" json:"status"` // pending, success, failed
    ResponseCode int    `json:"response_code"`
    ResponseBody string `gorm:"type:text" json:"response_body"`
    ErrorMessage string `gorm:"type:text" json:"error_message"`

    // Reference (optional: visit yg trigger event ini)
    VisitID *uint `gorm:"index" json:"visit_id,omitempty"`
    BedID   *uint `gorm:"index" json:"bed_id,omitempty"`
}
```

### 4.2 Model ICARE (Baru)

```go
// File: backend/models/icare.go

// ICareSyncStatus tracks I-Care sync status per visit
type ICareSyncStatus struct {
    ID        uint           `gorm:"primarykey" json:"id"`
    CreatedAt time.Time      `json:"created_at"`
    UpdatedAt time.Time      `json:"updated_at"`
    DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

    // Visit & SEP Reference
    VisitID uint   `gorm:"not null;uniqueIndex" json:"visit_id"`
    NoSEP   string `gorm:"size:50;not null;index" json:"no_sep"`

    // Sync Status per data type
    KunjunganSent   bool       `gorm:"default:false" json:"kunjungan_sent"`
    KunjunganSentAt *time.Time `json:"kunjungan_sent_at,omitempty"`
    KunjunganError  string     `gorm:"type:text" json:"kunjungan_error,omitempty"`

    DiagnosaSent   bool       `gorm:"default:false" json:"diagnosa_sent"`
    DiagnosaSentAt *time.Time `json:"diagnosa_sent_at,omitempty"`
    DiagnosaError  string     `gorm:"type:text" json:"diagnosa_error,omitempty"`

    ProsedurSent   bool       `gorm:"default:false" json:"prosedur_sent"`
    ProsedurSentAt *time.Time `json:"prosedur_sent_at,omitempty"`
    ProsedurError  string     `gorm:"type:text" json:"prosedur_error,omitempty"`

    PemeriksaanSent   bool       `gorm:"default:false" json:"pemeriksaan_sent"`
    PemeriksaanSentAt *time.Time `json:"pemeriksaan_sent_at,omitempty"`
    PemeriksaanError  string     `gorm:"type:text" json:"pemeriksaan_error,omitempty"`

    ResepSent   bool       `gorm:"default:false" json:"resep_sent"`
    ResepSentAt *time.Time `json:"resep_sent_at,omitempty"`
    ResepError  string     `gorm:"type:text" json:"resep_error,omitempty"`

    // Overall Status
    IsComplete bool `gorm:"default:false" json:"is_complete"` // All 5 data types sent
    RetryCount int  `gorm:"default:0" json:"retry_count"`

    // Relations
    Visit *Visit `gorm:"foreignKey:VisitID" json:"visit,omitempty"`
}
```

### 4.3 Integrasi Config Keys (Tambahan)

```go
// Di integration.go - tambahkan IntegrationType baru
const (
    IntegrationTypeBPJSAplicare IntegrationType = "bpjs-aplicare"
)

// Config keys APLICARE
var BPJSAplicareConfigKeys = []IntegrationConfigKey{
    {Integration: IntegrationTypeBPJSAplicare, Key: "cons_id", Description: "Consumer ID APLICARE", ...},
    {Integration: IntegrationTypeBPJSAplicare, Key: "secret_key", Description: "Secret Key APLICARE", ...},
    {Integration: IntegrationTypeBPJSAplicare, Key: "user_key", Description: "User Key APLICARE", ...},
    {Integration: IntegrationTypeBPJSAplicare, Key: "kode_ppk", Description: "Kode PPK/Faskes", ...},
    {Integration: IntegrationTypeBPJSAplicare, Key: "environment", Description: "Environment", ...},
    {Integration: IntegrationTypeBPJSAplicare, Key: "base_url_dev", Description: "Base URL Dev", ...},
    {Integration: IntegrationTypeBPJSAplicare, Key: "base_url_prod", Description: "Base URL Prod", ...},
    {Integration: IntegrationTypeBPJSAplicare, Key: "auto_sync_enabled", Description: "Auto sync saat event admission/discharge", Default: "true"},
}
```

---

## 5. Desain API (Backend)

### 5.1 Service Layer APLICARE

```go
// File: backend/services/bpjs/aplicare.go

type AplicareClient struct {
    ConsID     string
    SecretKey  string
    UserKey    string
    KodePPK    string
    BaseURL    string
    HTTPClient *http.Client
}

// === CRUD Ruangan di APLICARE ===
func (c *AplicareClient) GetDataRuangan() ([]AplicareRuangan, error)
func (c *AplicareClient) CreateRuangan(req CreateRuanganRequest) error
func (c *AplicareClient) UpdateRuangan(req UpdateRuanganRequest) error
func (c *AplicareClient) DeleteRuangan(kodeRuangan string) error

// === Update Ketersediaan TT (CORE) ===
func (c *AplicareClient) UpdateTempatTidur(req UpdateTTRequest) error

// === Helper: Sync dari SIMRS ke APLICARE ===
func SyncRoomToAplicare(roomID uint) error           // Sync 1 room
func SyncAllRoomsToAplicare() error                   // Sync semua room
func OnBedStatusChanged(bedID uint, event string) error // Trigger saat bed berubah
```

### 5.2 Service Layer ICARE

```go
// File: backend/services/bpjs/icare.go

type ICareClient struct {
    ConsID     string
    SecretKey  string
    UserKey    string
    BaseURL    string
    HTTPClient *http.Client
}

// === Kirim Data per Tipe ===
func (c *ICareClient) SendKunjungan(data KunjunganData) error
func (c *ICareClient) SendDiagnosa(data DiagnosaData) error
func (c *ICareClient) SendProsedur(data ProsedurData) error
func (c *ICareClient) SendPemeriksaan(data PemeriksaanData) error
func (c *ICareClient) SendResep(data ResepData) error

// === Helper: Bridge dari Visit SIMRS ===
func BridgeVisitToICare(visitID uint) error  // Kirim semua data visit
func RetryICareSync(visitID uint) error      // Retry yang gagal
```

### 5.3 Route Baru

```go
// File: backend/routes/bpjs.go - tambahan di SetupBPJSRoutes

// ==================== APLICARE ====================
aplicare := bpjs.Group("/aplicare")
aplicare.Use(middleware.RequirePermission("integrations.view"))
{
    // Room Mapping CRUD
    aplicare.GET("/mapping", handlers.GetAplicareRoomMappings)
    aplicare.POST("/mapping", handlers.CreateAplicareRoomMapping)
    aplicare.PUT("/mapping/:id", handlers.UpdateAplicareRoomMapping)
    aplicare.DELETE("/mapping/:id", handlers.DeleteAplicareRoomMapping)

    // Sync Operations
    aplicare.POST("/sync", handlers.SyncAllAplicare)         // Full sync
    aplicare.POST("/sync/:roomId", handlers.SyncRoomAplicare) // Sync 1 room
    aplicare.GET("/status", handlers.GetAplicareStatus)        // Status overview

    // BPJS Data (fetch from APLICARE)
    aplicare.GET("/ruangan", handlers.GetAplicareRuanganFromBPJS) // Get ruangan dari BPJS

    // Logs
    aplicare.GET("/logs", handlers.GetAplicareSyncLogs)
}

// ==================== ICARE ====================
icare := bpjs.Group("/icare")
icare.Use(middleware.RequirePermission("integrations.view"))
{
    // Sync Status
    icare.GET("/status", handlers.GetICareStatus)                // Overview
    icare.GET("/pending", handlers.GetICarePendingVisits)        // Visit yang belum sync
    icare.GET("/visit/:visitId", handlers.GetICareSyncByVisit)   // Status per visit

    // Manual Operations
    icare.POST("/send/:visitId", handlers.SendVisitToICare)      // Manual send 1 visit
    icare.POST("/send-batch", handlers.SendBatchToICare)          // Batch send
    icare.POST("/retry/:visitId", handlers.RetryICareSync)        // Retry

    // Logs
    icare.GET("/logs", handlers.GetICareSyncLogs)
}
```

---

## 6. Desain UX (Frontend)

### 6.1 APLICARE - UX Flow

#### A. Halaman Mapping Ruangan APLICARE
**Lokasi:** Menu Integrasi → BPJS → APLICARE → Mapping Ruangan

```
┌────────────────────────────────────────────────────────────────┐
│  APLICARE - Mapping Ruangan                          [+ Tambah]│
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌─ Filter ──────────────────────────────────────────────────┐ │
│  │ [🔍 Cari ruangan...]  [Kelas: Semua ▼]  [Status: Semua ▼]│ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Ruangan SIMRS    │ Kode BPJS │ Kelas │ TT  │ Status    │   │
│  ├──────────────────┼───────────┼───────┼─────┼───────────┤   │
│  │ R. Anggrek (RI)  │ RNG-001   │ VIP   │ 8/10│ ✅ Synced │   │
│  │ R. Mawar (RI)    │ RNG-002   │ Kls 1 │ 5/12│ ✅ Synced │   │
│  │ R. Melati (RI)   │ RNG-003   │ Kls 2 │ 8/20│ ⚠️ Error  │   │
│  │ R. Dahlia (RI)   │ RNG-004   │ Kls 3 │12/30│ ✅ Synced │   │
│  │ ICU              │ RNG-005   │ ICU   │ 3/5 │ ✅ Synced │   │
│  │ R. Kenanga (RI)  │ —         │ —     │ —   │ ❌ Unmapped│   │
│  └──────────────────┴───────────┴───────┴─────┴───────────┘   │
│                                                                │
│  [🔄 Sync Semua]  [📋 Ambil Data dari BPJS]                  │
│                                                                │
│  Terakhir sync: 17 Feb 2026, 14:30:21 • 5/6 ruangan mapped   │
└────────────────────────────────────────────────────────────────┘
```

#### B. Dashboard APLICARE (Real-time Bed Availability)
**Lokasi:** Menu Integrasi → BPJS → APLICARE → Dashboard

```
┌────────────────────────────────────────────────────────────────┐
│  APLICARE - Ketersediaan Tempat Tidur                         │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌─ Summary Cards ───────────────────────────────────────────┐ │
│  │  ╔══════════╗  ╔══════════╗  ╔══════════╗  ╔══════════╗  │ │
│  │  ║ Total TT ║  ║ Terisi   ║  ║ Kosong   ║  ║ Maint.   ║  │ │
│  │  ║   77     ║  ║   36     ║  ║   38     ║  ║    3     ║  │ │
│  │  ╚══════════╝  ╚══════════╝  ╚══════════╝  ╚══════════╝  │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌─ Per Kelas Ruangan ───────────────────────────────────────┐ │
│  │                                                            │ │
│  │  VVIP     ████░░░░░░  4/10 (40%)    [Sync ✅]             │ │
│  │  VIP      ██████░░░░  6/10 (60%)    [Sync ✅]             │ │
│  │  Kelas 1  ████████░░  8/10 (80%)    [Sync ✅]             │ │
│  │  Kelas 2  ██████████  15/20 (75%)   [Sync ✅]             │ │
│  │  Kelas 3  ██████████  20/30 (67%)   [Sync ✅]             │ │
│  │  ICU      ██████░░░░  3/5  (60%)    [Sync ✅]             │ │
│  │                                                            │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌─ Detail Per Ruangan ──────────────────────────────────────┐ │
│  │                                                            │ │
│  │  Ruangan        │ Kelas │ Total │ Terisi │ Kosong │ Sync  │ │
│  │  ───────────────┼───────┼───────┼────────┼────────┼─────  │ │
│  │  R. Anggrek     │ VIP   │  10   │   6    │   4    │  ✅   │ │
│  │  R. Mawar       │ Kls 1 │  12   │   8    │   4    │  ✅   │ │
│  │  R. Melati      │ Kls 2 │  20   │  15    │   5    │  ⚠️   │ │
│  │  R. Dahlia      │ Kls 3 │  30   │  20    │  10    │  ✅   │ │
│  │  ICU            │ ICU   │   5   │   3    │   2    │  ✅   │ │
│  │                                                            │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌─ Recent Activity ─────────────────────────────────────────┐ │
│  │  14:30 ▶ Admission R. Mawar Bed 3 → TT Kosong: 4  ✅     │ │
│  │  14:15 ▶ Discharge R. Dahlia Bed 12 → TT Kosong: 10 ✅   │ │
│  │  13:45 ▶ Transfer R. Melati→R. Anggrek → Update 2 room ✅│ │
│  │  13:20 ▶ Admission ICU Bed 3 → TT Kosong: 2  ✅         │ │
│  └───────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

#### C. Dialog Mapping Ruangan (Saat Tambah/Edit)

```
┌────────────────────────────────────────────┐
│  Mapping Ruangan APLICARE                  │
├────────────────────────────────────────────┤
│                                            │
│  Ruangan SIMRS *                           │
│  ┌──────────────────────────────────────┐  │
│  │ 🔍 R. Anggrek (Rawat Inap - VIP)  ▼ │  │
│  └──────────────────────────────────────┘  │
│  ℹ️ Hanya ruangan rawat inap yang bisa    │
│     di-mapping ke APLICARE                 │
│                                            │
│  Kode Ruangan BPJS *                       │
│  ┌──────────────────────────────────────┐  │
│  │ RNG-001                              │  │
│  └──────────────────────────────────────┘  │
│  💡 Atau ambil dari BPJS: [Fetch BPJS ▼]  │
│                                            │
│  Nama Ruangan BPJS *                       │
│  ┌──────────────────────────────────────┐  │
│  │ Ruangan Anggrek VIP                  │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  Kelas Ruangan *                           │
│  ┌──────────────────────────────────────┐  │
│  │ VIP                               ▼ │  │
│  └──────────────────────────────────────┘  │
│  Pilihan: Kelas 1, Kelas 2, Kelas 3,      │
│           VIP, VVIP, ICU, ICCU, HCU       │
│                                            │
│             [Batal]  [💾 Simpan & Sync]    │
└────────────────────────────────────────────┘
```

### 6.2 ICARE - UX Flow

#### A. Dashboard I-Care
**Lokasi:** Menu Integrasi → BPJS → I-Care → Dashboard

```
┌────────────────────────────────────────────────────────────────┐
│  I-Care - Bridging Data Primer                                │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌─ Summary Cards ───────────────────────────────────────────┐ │
│  │  ╔══════════╗  ╔══════════╗  ╔══════════╗  ╔══════════╗  │ │
│  │  ║ Visit    ║  ║ Ter-sync ║  ║ Pending  ║  ║ Gagal    ║  │ │
│  │  ║ Hari ini ║  ║          ║  ║          ║  ║          ║  │ │
│  │  ║   45     ║  ║   38     ║  ║    5     ║  ║    2     ║  │ │
│  │  ╚══════════╝  ╚══════════╝  ╚══════════╝  ╚══════════╝  │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌─ Filter ──────────────────────────────────────────────────┐ │
│  │ [📅 Hari ini ▼]  [Status: Semua ▼]  [🔍 Cari pasien...]│ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌─ Daftar Visit dengan SEP ─────────────────────────────────┐ │
│  │                                                            │ │
│  │  No SEP          │ Pasien      │ Poli    │ Status I-Care  │ │
│  │  ────────────────┼─────────────┼─────────┼────────────────│ │
│  │  0012345678901   │ Budi S.     │ Dalam   │ ✅ Complete    │ │
│  │  0012345678902   │ Ani W.      │ Bedah   │ ⏳ 4/5 sent   │ │
│  │  0012345678903   │ Citra D.    │ Anak    │ ❌ 2/5 failed  │ │
│  │  0012345678904   │ Deni P.     │ Mata    │ ⏳ Pending     │ │
│  │                                                            │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                │
│  [🔄 Kirim Semua Pending]  [⟳ Retry Semua Gagal]             │
└────────────────────────────────────────────────────────────────┘
```

#### B. Detail Sync per Visit (klik baris di tabel)

```
┌────────────────────────────────────────────────────────────────┐
│  I-Care Sync Detail - SEP 0012345678903                       │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Pasien: Citra Dewi  │  Poli: Anak  │  Dokter: dr. Hakim     │
│  No. RM: 000123      │  Tanggal: 17/02/2026                   │
│                                                                │
│  ┌─ Status Pengiriman ───────────────────────────────────────┐ │
│  │                                                            │ │
│  │  ┌──────────────┬─────────┬──────────┬──────────────────┐ │ │
│  │  │ Data         │ Status  │ Waktu    │ Aksi             │ │ │
│  │  ├──────────────┼─────────┼──────────┼──────────────────┤ │ │
│  │  │ Kunjungan    │ ✅ Sent │ 14:30:21 │                  │ │ │
│  │  │ Diagnosa     │ ✅ Sent │ 14:30:22 │                  │ │ │
│  │  │ Prosedur     │ ❌ Fail │ 14:30:23 │ [🔄 Retry]       │ │ │
│  │  │ Pemeriksaan  │ ❌ Fail │ 14:30:24 │ [🔄 Retry]       │ │ │
│  │  │ Resep Obat   │ ⏳ —    │ —        │ [▶ Kirim]        │ │ │
│  │  └──────────────┴─────────┴──────────┴──────────────────┘ │ │
│  │                                                            │ │
│  │  Error: "Timeout saat kirim data prosedur"                 │ │
│  │                                                            │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌─ Data yang akan dikirim ──────────────────────────────────┐ │
│  │  Diagnosa: J06.9 - Infeksi saluran pernapasan atas        │ │
│  │  Prosedur: -                                               │ │
│  │  Vital: TD 120/80, Nadi 88, Suhu 37.2                     │ │
│  │  Resep: Amoxicillin 500mg 3x1, Paracetamol 500mg 3x1    │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                │
│             [🔄 Retry Semua Gagal]  [Tutup]                   │
└────────────────────────────────────────────────────────────────┘
```

#### C. Integrasi di Halaman Visit (Inline)

Pada halaman visit yang sudah ada (`/visits/:id`), tambahkan tab/section "I-Care" yang menampilkan status bridging saat visit memiliki SEP:

```
┌─────────────────────────────────────────────────┐
│ Tab: [Rekam Medis] [Resep] [Tindakan] [I-Care]  │
├─────────────────────────────────────────────────┤
│                                                  │
│  I-Care Bridging                      Auto: ✅   │
│  ─────────────────────────────────────────────── │
│  SEP: 0012345678903                              │
│                                                  │
│  ● Kunjungan    ✅ Terkirim (14:30)              │
│  ● Diagnosa     ✅ Terkirim (14:30)              │
│  ● Prosedur     ⏳ Menunggu visit selesai        │
│  ● Pemeriksaan  ⏳ Menunggu visit selesai        │
│  ● Resep        ⏳ Menunggu visit selesai        │
│                                                  │
│  [Kirim Manual]                                  │
└─────────────────────────────────────────────────┘
```

### 6.3 Integrasi pada Floor Plan / Building Management

Pada halaman building management yang sudah ada, tambahkan **badge APLICARE** pada setiap room card:

```
┌─────────────────────────────────────────────────┐
│  R. Anggrek (VIP)              APLICARE: ✅     │
│  Bed: 6/10 terisi                                │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐            │
│  │🟢1 │ │🔴2 │ │🔴3 │ │🟢4 │ │🔴5 │            │
│  └────┘ └────┘ └────┘ └────┘ └────┘            │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐            │
│  │🔴6 │ │🟢7 │ │🔴8 │ │🟢9 │ │🔴10│            │
│  └────┘ └────┘ └────┘ └────┘ └────┘            │
│                                                  │
│  🟢 Kosong  🔴 Terisi  🟡 Maintenance           │
└─────────────────────────────────────────────────┘
```

---

## 7. Integrasi dengan Fitur Existing

### 7.1 APLICARE ↔ Admission Request

Saat `AdmissionRequest` diproses (assign bed ke pasien):

```
ProcessAdmissionRequest()
    ↓
    Assign bed → bed.Status = "occupied"
    ↓
    Check: Apakah APLICARE auto_sync aktif?
    ↓ Ya
    OnBedStatusChanged(bed.ID, "admission")
    ↓
    Hitung ulang TT kosong untuk room terkait
    ↓
    AplicareClient.UpdateTempatTidur(kodeRuangan, totalTT, ttTerisi, ttKosong)
    ↓
    Simpan AplicareSyncLog
```

### 7.2 APLICARE ↔ Discharge

Saat pasien di-discharge dari rawat inap:

```
DischargeVisit() / CompleteInpatientVisit()
    ↓
    bed.Status = "available"
    ↓
    OnBedStatusChanged(bed.ID, "discharge")
    ↓
    (sama seperti di atas)
```

### 7.3 APLICARE ↔ Bed Transfer

Saat pasien dipindahkan antar bed:

```
TransferBed()
    ↓
    Old bed.Status = "available"
    New bed.Status = "occupied"
    ↓
    OnBedStatusChanged(oldBed.ID, "transfer_out")
    OnBedStatusChanged(newBed.ID, "transfer_in")
    ↓
    Update 2 ruangan di APLICARE (jika beda room)
```

### 7.4 ICARE ↔ Visit Completion

Saat visit selesai dilayani:

```
CompleteVisit()
    ↓
    visit.Status = "completed"
    ↓
    Check: Visit punya SEP?
    ↓ Ya
    Check: ICARE auto_sync aktif?
    ↓ Ya
    BridgeVisitToICare(visit.ID)
    ↓
    Kirim: Kunjungan → Diagnosa → Prosedur → Pemeriksaan → Resep
    ↓
    Update ICareSyncStatus
```

### 7.5 ICARE ↔ SEP Creation

Saat SEP dibuat, otomatis buat record ICareSyncStatus:

```
VClaimCreateSEP()
    ↓
    SEP berhasil dibuat
    ↓
    Create ICareSyncStatus{VisitID, NoSEP, semua sent: false}
    ↓
    (Akan di-fill saat visit completed)
```

---

## 8. Tahapan Implementasi

### Phase 1: APLICARE (Prioritas Tinggi - 1-2 Minggu)

| # | Task | File | Estimasi |
|---|------|------|----------|
| 1 | Model `AplicareRoomMapping` & `AplicareSyncLog` | `models/aplicare.go` | 2 jam |
| 2 | Migration (auto-migrate) | `database/database.go` | 30 menit |
| 3 | Tambah `IntegrationTypeBPJSAplicare` + config keys | `models/integration.go` | 1 jam |
| 4 | Service `AplicareClient` (BPJS API calls) | `services/bpjs/aplicare.go` | 4 jam |
| 5 | Handler CRUD mapping + sync | `handlers/aplicare.go` | 4 jam |
| 6 | Routes APLICARE | `routes/bpjs.go` | 30 menit |
| 7 | Hook di admission/discharge/transfer | `handlers/admission_request.go`, `handlers/building.go` | 3 jam |
| 8 | Frontend: API client APLICARE | `lib/api/aplicare.ts` | 2 jam |
| 9 | Frontend: Halaman mapping | `pages/aplicare/mapping.tsx` | 4 jam |
| 10 | Frontend: Dashboard APLICARE | `pages/aplicare/dashboard.tsx` | 4 jam |
| 11 | Frontend: Tambah di integrations config | `pages/integrations/config.tsx` | 1 jam |
| 12 | Frontend: Badge APLICARE di building page | `pages/buildings/index.tsx` | 2 jam |

### Phase 2: ICARE (Prioritas Sedang - 1-2 Minggu)

| # | Task | File | Estimasi |
|---|------|------|----------|
| 1 | Model `ICareSyncStatus` | `models/icare.go` | 1 jam |
| 2 | Migration | `database/database.go` | 30 menit |
| 3 | Service `ICareClient` (BPJS API calls) | `services/bpjs/icare.go` | 6 jam |
| 4 | Data transformer (Visit → ICARE format) | `services/bpjs/icare_transform.go` | 4 jam |
| 5 | Handler ICARE | `handlers/icare.go` | 4 jam |
| 6 | Routes ICARE | `routes/bpjs.go` | 30 menit |
| 7 | Hook di visit completion | `handlers/visit.go` atau event system | 3 jam |
| 8 | Background worker (retry failed syncs) | `services/bpjs/icare_worker.go` | 3 jam |
| 9 | Frontend: API client ICARE | `lib/api/icare.ts` | 2 jam |
| 10 | Frontend: Dashboard ICARE | `pages/icare/dashboard.tsx` | 4 jam |
| 11 | Frontend: Detail sync per visit | `pages/icare/detail.tsx` | 3 jam |
| 12 | Frontend: Tab I-Care di halaman visit | `pages/visits/show.tsx` | 3 jam |
| 13 | Frontend: Tambah di integrations config | `pages/integrations/config.tsx` | 1 jam |

### Phase 3: Polish & Testing (1 Minggu)

| # | Task |
|---|------|
| 1 | Unit test service APLICARE & ICARE |
| 2 | Integration test dengan BPJS sandbox |
| 3 | Error handling & retry mechanism |
| 4 | Notification (websocket) saat sync gagal |
| 5 | Cron job periodic sync (APLICARE: setiap 5 menit, ICARE: retry setiap 15 menit) |
| 6 | Documentation API internal |

---

## Ringkasan Keputusan Desain

| Aspek | Keputusan | Alasan |
|-------|-----------|--------|
| APLICARE Trigger | Event-driven (real-time) + periodic fallback | BPJS butuh data real-time, periodic sebagai safety net |
| ICARE Trigger | Batch saat visit selesai | Data medis baru lengkap saat visit selesai |
| Config Storage | Reuse `integration_configs` table | Konsisten dengan pattern existing (VClaim, Antrian, SatuSehat) |
| Sync Log | Model terpisah per service | Memudahkan query & monitoring per service |
| Frontend Structure | Halaman terpisah, tapi terintegrasi di visit/building page | UX terpusat di dashboard, tapi konteks juga tampil inline |
| Error Handling | Auto-retry with exponential backoff + manual retry | Mengurangi beban manual, tapi tetap bisa intervene |
| Auth Pattern | Reuse BPJS auth pattern (HMAC-SHA256, AES decrypt) | Semua BPJS API pakai pattern yang sama |
