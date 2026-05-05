# Rencana Perbaikan Konsistensi Sistem SIMRS

> Dibuat: 5 Mei 2026  
> Status: Draft  
> Prioritas: Kritis → Tinggi → Sedang → Rendah

---

## FASE 1 — Backend: GORM Column Name Mismatch (DATA CORRUPT)

> **Dampak**: Data masuk ke kolom salah secara diam-diam. Tidak ada error, tapi field yang disimpan/dibaca salah.

### 1.1 `medical_record.go` — Struct `Triage`

| Field Go | Kolom GORM (sekarang, salah) | Kolom yang benar | Fix |
|---|---|---|---|
| `GCSE int` | `gcse` | `gcs_e` | Tambah `gorm:"column:gcs_e"` |
| `GCSV int` | `gcsv` | `gcs_v` | Tambah `gorm:"column:gcs_v"` |
| `GCSM int` | `gcsm` | `gcs_m` | Tambah `gorm:"column:gcs_m"` |

### 1.2 `patient.go` — Struct `Patient`

| Field Go | Kolom GORM (sekarang, salah) | Kolom yang benar | Fix |
|---|---|---|---|
| `RTKTP string` | `rtktp` | `rt_ktp` | Tambah `gorm:"column:rt_ktp"` |
| `RWKTP string` | `rwktp` | `rw_ktp` | Tambah `gorm:"column:rw_ktp"` |

### 1.3 `spri.go`, `surat_kontrol.go`, `eklaim_local.go`

| Field Go | Kolom GORM (sekarang, salah) | Kolom yang benar | Fix |
|---|---|---|---|
| `SEPID *uint` / `uint` | `sepid` | `sep_id` | Tambah `gorm:"column:sep_id"` di ketiga file |

### 1.4 `eklaim.go` — Struct `EKlaim`

| Field Go | Kolom GORM (sekarang, salah) | Kolom yang benar | Fix |
|---|---|---|---|
| `LOSICU int` | `losicu` | `los_icu` | Tambah `gorm:"column:los_icu"` |
| `LOSNICU int` | `losnicu` | `los_nicu` | Tambah `gorm:"column:los_nicu"` |

> ⚠️ Setelah fix, jalankan migration SQL manual untuk rename kolom di database yang sudah berjalan.

---

## FASE 2 — Backend: Missing `uniqueIndex` pada Business Key

> **Dampak**: Data duplikat bisa masuk ke database. NoRM pasien kembar, user email ganda, dll.

| File | Struct | Field | Tindakan |
|---|---|---|---|
| `patient.go` | `Patient` | `NoRM string` | Ganti ke `gorm:"size:20;not null;uniqueIndex"` |
| `user.go` | `User` | `Email string` | Tambah `uniqueIndex` |
| `user.go` | `User` | `Username string` | Tambah `uniqueIndex` |
| `room.go` | `Room` | `Code string` | Ganti `not null` ke `not null;uniqueIndex` |
| `counter.go` | `Counter` | `Code string` | Ganti `index` ke `uniqueIndex` |

> ⚠️ Cek dulu apakah sudah ada data duplikat di database sebelum menambah constraint uniqueIndex.

---

## FASE 3 — Backend: Missing Index pada Foreign Key

> **Dampak**: Full-table scan di tabel yang paling sering diquery (registrations, queues). Performa lambat seiring data bertambah.

### 3.1 `registration.go` — tabel `registrations`

```go
// Sebelum:
QueueID            *uint `json:"queue_id"`
DestinationRoomID  uint  `gorm:"not null"`
DoctorID           *uint `json:"doctor_id"`
RegisteredByID     uint  `json:"registered_by_id"`
CheckedInByID      *uint `json:"checked_in_by_id,omitempty"`

// Sesudah:
QueueID            *uint `gorm:"index" json:"queue_id"`
DestinationRoomID  uint  `gorm:"not null;index"`
DoctorID           *uint `gorm:"index" json:"doctor_id"`
RegisteredByID     uint  `gorm:"not null;index" json:"registered_by_id"`
CheckedInByID      *uint `gorm:"index" json:"checked_in_by_id,omitempty"`
```

### 3.2 `queue.go` — tabel `queues`

```go
// Sebelum:
CounterID  uint  `gorm:"not null"`
CalledByID *uint `json:"called_by_id"`

// Sesudah:
CounterID  uint  `gorm:"not null;index"`
CalledByID *uint `gorm:"index" json:"called_by_id"`
```

### 3.3 `patient.go` — audit/tracking fields

```go
// Sesudah:
FinalizedBy *uint `gorm:"index" json:"finalized_by,omitempty"`
CreatedBy   *uint `gorm:"index" json:"created_by,omitempty"`
UpdatedBy   *uint `gorm:"index" json:"updated_by,omitempty"`
```

### 3.4 `eklaim.go` — finalization tracking

```go
IDRGFinalizedBy    *uint `gorm:"index" json:"idrg_finalized_by"`
INACBGFinalizedBy  *uint `gorm:"index" json:"inacbg_finalized_by"`
ClaimFinalizedBy   *uint `gorm:"index" json:"claim_finalized_by"`
ClaimSentBy        *uint `gorm:"index" json:"claim_sent_by"`
```

---

## FASE 4 — Backend: Missing Composite Unique Index

> **Dampak**: Data ganda dalam tabel relasi. User bisa di-assign ke ruangan yang sama 2x, obat bisa terdaftar 2x di ruangan yang sama, dll.

| File | Struct | Composite Index yang Harus Ditambah |
|---|---|---|
| `notification.go` | `UserRoomAssignment` | `uniqueIndex:"idx_user_room,composite:user_id,room_id"` |
| `medicine.go` | `RoomMedicine` | `uniqueIndex:"idx_room_med,composite:room_id,medicine_id"` |
| `inventory.go` | `RoomInventory` | `uniqueIndex:"idx_room_inv,composite:room_id,inventory_id"` |
| `schedule.go` | `DoctorSchedule` | `uniqueIndex:"idx_doctor_sched,composite:room_id,employee_id,day_of_week"` |

---

## FASE 5 — Backend: Inkonsistensi Nama Field Lintas Model

> **Dampak**: Query cross-table non-obvious, risk salah join, API response membingungkan frontend.

### 5.1 Nomor Kartu BPJS — 3 nama berbeda

Saat ini ada 3 nama: `no_bpjs` (Patient), `bpjs_number` (Registration), `no_kartu` (SEP, EKlaim, dll.)

**Keputusan yang perlu dibuat:**
- Pilih satu standar: `no_kartu` (mengikuti terminologi BPJS resmi) atau `no_bpjs`
- Update semua model yang menyimpang
- Update handler/API response yang mengirim field ini
- Update frontend yang membaca field ini

### 5.2 Nomor Polis Asuransi

| Model | Field saat ini | Standar yang disarankan |
|---|---|---|
| `Registration`, `BillingPayment` | `insurance_number` | `insurance_number` ✅ |
| `Billing` | `insurance_no` | Ganti ke `insurance_number` |

### 5.3 FK ke `procedure_parameters`

| Model | Field saat ini | Standar yang disarankan |
|---|---|---|
| `ProcedureOrderResult` | `ProcedureParameterID` | `ProcedureParameterID` ✅ |
| `VisitProcedureResult` | `ParameterID` | Ganti ke `ProcedureParameterID` |

---

## FASE 6 — Backend: Inkonsistensi Tipe Data Vital Sign

> **Dampak**: Tidak bisa aggregasi/komparasi vital sign lintas encounter. Logika validasi tidak bisa distandarisasi.

| Vital Sign | Model | Field | Tipe Saat Ini | Target |
|---|---|---|---|---|
| Heart Rate | `Triage`, `PhysicalExamination` | `HeartRate` | `string` | `int` |
| Heart Rate | `CPPT` | `HeartRate` | `int` | ✅ sudah benar |
| Respiratory Rate | `Triage` | `BreathingRate` | `string` | Rename ke `RespiratoryRate`, type `int` |
| Respiratory Rate | `PhysicalExamination` | `RespiratoryRate` | `string` | `int` |
| Respiratory Rate | `CPPT` | `RespiratoryRate` | `int` | ✅ sudah benar |
| Oxygen Saturation | `Triage`, `PhysicalExamination` | `OxygenSaturation` | `string` | `int` |
| Oxygen Saturation | `CPPT` | `OxygenSaturation` | `int` | ✅ sudah benar |
| Birth Weight | `EKlaim` | `BeratLahir` | `float64` | `float64` ✅ |
| Birth Weight | `EKlaimLocal` | `BirthWeight` | `string` | `float64` |

> ⚠️ Perubahan tipe dari string ke int memerlukan migrasi data dan update semua handler/form yang mengisi field ini.

---

## FASE 7 — Backend: Polarity Boolean Berlawanan

> **Dampak**: Logic bug diam-diam. Query "ambil semua hasil normal" akan ambil hasil abnormal jika salah pilih tabel.

**File:** `procedure_order.go` vs `visit_procedure.go`

| Model | Field | Makna `true` |
|---|---|---|
| `ProcedureOrderResult` | `IsNormal bool` | hasil normal |
| `VisitProcedureResult` | `IsAbnormal bool` | hasil abnormal ← terbalik |

**Fix:** Ganti `IsAbnormal` di `VisitProcedureResult` menjadi `IsNormal` (atau sebaliknya, pilih satu).

Juga seragamkan nama field numeric result:

| Model | Field saat ini | Standar |
|---|---|---|
| `ProcedureOrderResult` | `NumericValue float64` | `NumericValue` ✅ |
| `VisitProcedureResult` | `NumValue float64` | Ganti ke `NumericValue` |

---

## FASE 8 — Backend: EKlaim Financial Field Tanpa Presisi Desimal

> **Dampak**: Floating-point rounding error pada perhitungan keuangan klaim.

**File:** `eklaim.go`

Semua field tarif dan finansial harus ditambah `gorm:"type:decimal(15,2)"`:

```go
TarifRS          float64 `gorm:"type:decimal(15,2)" json:"tarif_rs"`
TarifProsedur    float64 `gorm:"type:decimal(15,2)" json:"tarif_prosedur"`
TarifAlkes       float64 `gorm:"type:decimal(15,2)" json:"tarif_alkes"`
TarifObat        float64 `gorm:"type:decimal(15,2)" json:"tarif_obat"`
TarifKamar       float64 `gorm:"type:decimal(15,2)" json:"tarif_kamar"`
TarifLainnya     float64 `gorm:"type:decimal(15,2)" json:"tarif_lainnya"`
TotalTarifRS     float64 `gorm:"type:decimal(15,2)" json:"total_tarif_rs"`
IDRGTarif        float64 `gorm:"type:decimal(15,2)" json:"idrg_tarif"`
INACBGTarif      float64 `gorm:"type:decimal(15,2)" json:"inacbg_tarif"`
TarifVerifikasi  float64 `gorm:"type:decimal(15,2)" json:"tarif_verifikasi"`
```

---

## FASE 9 — Frontend: Bug Field yang Tidak Exist

### 9.1 `registrations/columns.tsx` — Patient Cell

```tsx
// SEKARANG (SALAH — field tidak ada di backend):
patient.nama_lengkap || patient.name
patient.no_rm || patient.medical_record_number

// SESUDAH (benar):
patient.nama_lengkap
patient.no_rm
```

### 9.2 `registrations/columns.tsx` — Doctor Cell

```tsx
// SEKARANG (SALAH):
doctor.nama_lengkap || doctor.nama || doctor.name

// SESUDAH (benar):
doctor.nama_lengkap
```

---

## FASE 10 — Frontend: Wrong Enum di Room Medicine Badge

**File:** `rooms/components/medicine/columns.tsx`

`getTypeBadgeColor()` saat ini mendefinisikan warna untuk nilai yang tidak ada di backend.

| Nilai di kode frontend | Ada di backend? |
|---|---|
| `ethical`, `generic`, `patent` | ❌ bukan MedicineType |
| `herbal`, `supplement`, `cosmetic` | ❌ bukan MedicineType |
| `otc` | ✅ |
| `limited`, `hard`, `narcotic`, `psychotrope` | ❌ tidak ada warnanya |

**Fix:** Update `getTypeBadgeColor()` untuk mencocokkan enum backend yang benar:
```
otc → hijau
limited → kuning  
hard → oranye
narcotic → merah
psychotrope → ungu
```

---

## FASE 11 — Frontend: Standarisasi Label `is_active`

> **Dampak**: User melihat teks berbeda untuk konsep yang sama di halaman berbeda.

**Standar yang dipilih:** `"Tidak Aktif"` (lebih formal, sudah digunakan di Rooms, Inventories, Counters show, Employees)

File yang perlu diubah dari `"Nonaktif"` ke `"Tidak Aktif"`:

| File | Baris | Saat ini | Sesudah |
|---|---|---|---|
| `medicines/columns.tsx` | ~240 | `"Nonaktif"` | `"Tidak Aktif"` |
| `medicines/show.tsx` | ~147 | `"Nonaktif"` | `"Tidak Aktif"` |
| `procedures/columns.tsx` | ~183 | `"Nonaktif"` | `"Tidak Aktif"` |
| `procedures/show.tsx` | ~142 | `"Nonaktif"` | `"Tidak Aktif"` |
| `clinical-packages/columns.tsx` | ~47 | `"Nonaktif"` | `"Tidak Aktif"` |
| `clinical-packages/show.tsx` | ~78 | `"Nonaktif"` | `"Tidak Aktif"` |
| `icd/columns.tsx` | ~101 | `"Nonaktif"` | `"Tidak Aktif"` |
| `icd/show.tsx` | ~121, 190 | `"Nonaktif"` | `"Tidak Aktif"` |
| `counters/columns.tsx` | ~58 | `"Nonaktif"` | `"Tidak Aktif"` |
| `ppk/index.tsx` | ~193 | `"Nonaktif"` | `"Tidak Aktif"` |
| `master-data/category.tsx` | ~126 | `"Nonaktif"` | `"Tidak Aktif"` |
| `buildings/index.tsx` | ~228 | `"Nonaktif"` | `"Tidak Aktif"` |
| `nutrition/menus/columns.tsx` | ~99 | `"Nonaktif"` | `"Tidak Aktif"` |
| `nutrition/menus/show.tsx` | ~77 | `"Nonaktif"` | `"Tidak Aktif"` |
| `nutrition/meal-packages/columns.tsx` | ~82 | `"Nonaktif"` | `"Tidak Aktif"` |
| `nutrition/meal-packages/show.tsx` | ~87 | `"Nonaktif"` | `"Tidak Aktif"` |
| `rooms/components/tariff/columns.tsx` | ~120 | `"Nonaktif"` | `"Tidak Aktif"` |
| `rooms/components/clinical-package-assignment-panel.tsx` | ~124, 181 | `"Nonaktif"` | `"Tidak Aktif"` |

---

## FASE 12 — Frontend: Standarisasi Badge Variant `is_active`

> **Dampak**: Status aktif tampil dengan warna berbeda di halaman berbeda.

Pola yang benar (seragamkan seluruh codebase):
```tsx
<Badge variant={is_active ? "default" : "secondary"}>
  {is_active ? "Aktif" : "Tidak Aktif"}
</Badge>
```

File yang menggunakan pola berbeda (perlu dicek manual):
- `counters/columns.tsx` — sudah benar (`default`/`secondary`)
- `inventories/columns.tsx` — sudah benar (`default`/`secondary`)

---

## FASE 13 — Frontend: Fix `counter_id` accessor di `queues/columns.tsx`

```tsx
// SEKARANG (SALAH — sort/filter beroperasi pada integer ID):
{
  accessorKey: "counter_id",
  header: "Loket",
  cell: ({ row }) => row.original.counter?.name,
}

// SESUDAH (benar — sort/filter beroperasi pada nama loket):
{
  id: "counter",
  accessorFn: (row) => row.counter?.name ?? "",
  header: "Loket",
  cell: ({ row }) => row.original.counter?.name,
}
```

---

## FASE 14 — Frontend: Redesain DataTable (Bordered Style)

Lihat implementasi baru di `src/components/ui/data-table.tsx` dan `src/components/ui/table.tsx`.

**Perubahan utama:**
- Table dengan border penuh di setiap sel (grid style)
- Header dengan background yang lebih solid dan teks lebih jelas
- Row striping (zebra) untuk keterbacaan
- Cell padding lebih compact
- Sticky header dengan border bottom yang tegas
- Pagination redesign: lebih ringkas, info di kiri

---

## Ringkasan Prioritas dan Estimasi

| Fase | Prioritas | Kategori | Kompleksitas |
|---|---|---|---|
| 1–Fase 1 | 🔴 Kritis | Backend | Rendah (tambah tag GORM) |
| 2–Fase 2 | 🔴 Kritis | Backend | Rendah (tambah uniqueIndex) |
| 3–Fase 9 | 🔴 Kritis | Frontend | Rendah (hapus fallback) |
| 4–Fase 10 | 🔴 Kritis | Frontend | Rendah (fix enum map) |
| 5–Fase 3 | 🟡 Tinggi | Backend | Rendah (tambah index) |
| 6–Fase 4 | 🟡 Tinggi | Backend | Rendah (tambah composite index) |
| 7–Fase 8 | 🟡 Tinggi | Backend | Rendah (tambah decimal type) |
| 8–Fase 11 | 🟡 Tinggi | Frontend | Rendah (find-replace) |
| 9–Fase 12 | 🟡 Tinggi | Frontend | Rendah (find-replace) |
| 10–Fase 13 | 🟡 Tinggi | Frontend | Rendah (ubah accessor) |
| 11–Fase 14 | 🟡 Tinggi | Frontend | Sedang (redesain komponen) |
| 12–Fase 5 | 🟠 Sedang | Backend | Tinggi (refactor + migration) |
| 13–Fase 6 | 🟠 Sedang | Backend | Tinggi (migrasi tipe data) |
| 14–Fase 7 | 🟠 Sedang | Backend | Sedang (rename field + migration) |

---

## Catatan Migrasi Database

Untuk perubahan yang mempengaruhi schema yang sudah berjalan di production, jalankan SQL berikut **setelah** update model Go:

```sql
-- Fase 1.1: GCS columns di tabel triages
ALTER TABLE triages RENAME COLUMN gcse TO gcs_e;
ALTER TABLE triages RENAME COLUMN gcsv TO gcs_v;
ALTER TABLE triages RENAME COLUMN gcsm TO gcs_m;

-- Fase 1.2: Patient KTP columns
ALTER TABLE patients RENAME COLUMN rtktp TO rt_ktp;
ALTER TABLE patients RENAME COLUMN rwktp TO rw_ktp;

-- Fase 1.3: SEP ID columns
ALTER TABLE spris RENAME COLUMN sepid TO sep_id;
ALTER TABLE surat_kontrols RENAME COLUMN sepid TO sep_id;
ALTER TABLE eklaim_locals RENAME COLUMN sepid TO sep_id;

-- Fase 1.4: EKlaim LOS columns
ALTER TABLE eklaims RENAME COLUMN losicu TO los_icu;
ALTER TABLE eklaims RENAME COLUMN losnicu TO los_nicu;
```
