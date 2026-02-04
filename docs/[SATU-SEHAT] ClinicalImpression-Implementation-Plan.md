# Rencana Implementasi ClinicalImpression (SATUSEHAT)

## Daftar Isi

1. [Apa Itu ClinicalImpression](#1-apa-itu-clinicalimpression)
2. [Syarat Pengiriman](#2-syarat-pengiriman-ke-satusehat)
3. [Status di SIMRS Saat Ini](#3-status-di-simrs-saat-ini)
4. [Alur Rawat Jalan (AMB)](#4-alur-rawat-jalan-amb)
5. [Alur Rawat Inap (IMP)](#5-alur-rawat-inap-imp)
6. [Alur IGD (EMER)](#6-alur-igd-emer)
7. [Jenis ClinicalImpression yang Akan Dibangun](#7-jenis-clinicalimpression-yang-akan-dibangun)
8. [Mapping Data SIMRS ke FHIR](#8-mapping-data-simrs-ke-fhir)
9. [Payload FHIR yang Akan Dikirim](#9-payload-fhir-yang-akan-dikirim)
10. [Rencana Teknis Implementasi](#10-rencana-teknis-implementasi)

---

## 1. Apa Itu ClinicalImpression

**ClinicalImpression** adalah resource FHIR yang merepresentasikan **penilaian klinis dokter** terhadap kondisi pasien. Ini mencakup:

- **Riwayat Perjalanan Penyakit** - rangkuman anamnesis, keluhan, dan riwayat penyakit
- **Rasional Klinis** - alasan/pertimbangan dokter menentukan diagnosis dan terapi
- **Prognosis** - prediksi dokter terhadap perjalanan penyakit ke depan

Dalam konteks SATUSEHAT, ClinicalImpression dikirim **setelah** dokter melakukan asesmen dan **sebelum/bersamaan** dengan penentuan diagnosis akhir. Ini adalah "catatan pemikiran klinis" dokter, bukan sekedar data mentah.

### Perbedaan dengan Resource Lain

| Resource | Fungsi |
|----------|--------|
| **Condition** | Diagnosis (kode ICD-10) - **APA** diagnosisnya |
| **Observation** | Hasil pemeriksaan (vital sign, lab) - **DATA** yang ditemukan |
| **ClinicalImpression** | Penilaian dokter - **MENGAPA** diagnosis itu ditegakkan |
| **Composition** | Resume medis - **RANGKUMAN** seluruh kunjungan |

---

## 2. Syarat Pengiriman ke SATUSEHAT

### Prasyarat Wajib (Harus Sudah Dikirim)

| # | Resource | Alasan |
|---|----------|--------|
| 1 | **Patient** | IHS Number pasien harus sudah ada |
| 2 | **Practitioner** | IHS Number dokter/penilai harus sudah ada |
| 3 | **Encounter** | Kunjungan harus sudah dikirim (encounter ID) |

### Prasyarat Data (Harus Sudah Diisi di SIMRS)

| # | Data | Sumber di SIMRS | Wajib? |
|---|------|-----------------|--------|
| 1 | Kesan klinis / Asesmen dokter | `DiagnosisSummary.ClinicalImpression` atau `AssessmentPlan.ClinicalAssessment` | **Ya** |
| 2 | Encounter ID SatuSehat | `Visit.SatuSehatEncounterID` | **Ya** |
| 3 | Patient IHS Number | `Patient.SatuSehatID` | **Ya** |
| 4 | Practitioner IHS Number | `Employee.SatuSehatID` (dokter) | **Ya** |
| 5 | Prognosis | `AssessmentPlan.Prognosis` | Tidak (opsional) |
| 6 | Investigation / Pemeriksaan | `Observation` (vital signs, lab) | Tidak (opsional) |

### Urutan Pengiriman dalam Alur FHIR

```
Encounter → Condition (keluhan) → Observation → ClinicalImpression → Condition (diagnosis) → dst
```

ClinicalImpression dikirim **setelah** Observation (pemeriksaan) dan **sebelum/bersamaan** dengan Condition diagnosis.

---

## 3. Status di SIMRS Saat Ini

### Data yang SUDAH Ada (Siap Dipakai)

| Data | Model / Tabel | Field | Status |
|------|---------------|-------|--------|
| Kesan Klinis | `DiagnosisSummary` | `clinical_impression` | Ada, diisi dokter via form |
| Kesan Klinis (Assessment) | `AssessmentPlan` | `clinical_assessment` | Ada, diisi dokter via form |
| Diagnosis Banding | `DiagnosisSummary` | `differential_diagnosis` | Ada |
| Prognosis | `AssessmentPlan` | `prognosis` | Ada (teks bebas) |
| SOAP Notes | `Consultation` | `subjective`, `objective`, `assessment`, `plan` | Ada (untuk konsultasi) |
| Asesmen Triage | `Triage` | `triage_assessment` | Ada (untuk IGD) |
| Level Triage | `Triage` | `triage_level` | Ada (ESI 0-5) |
| GCS Score | `Triage` | `gcse`, `gcsv`, `gcsm` | Ada (untuk IGD) |
| Anamnesis Lengkap | `Anamnesis` | `chief_complaint`, `history_of_present_illness`, dll | Ada |
| Pemeriksaan Fisik | `PhysicalExamination` | Semua field head-to-toe | Ada |

### Yang BELUM Ada (Perlu Ditambahkan)

| Komponen | Status | Yang Perlu Dibuat |
|----------|--------|-------------------|
| FHIR Struct `FHIRClinicalImpression` | Belum ada | Buat struct baru |
| Build function | Belum ada | `BuildFHIRClinicalImpression()` |
| Send handler | Belum ada | `SendClinicalImpressionToSatuSehat()` |
| Route endpoint | Belum ada | `POST /composition/:id/send` |
| Database tracking field | Belum ada | `SatusehatClinicalImpressionID` di tabel terkait |
| Frontend send button | Belum ada | Tambah di status monitoring dialog |
| Kode prognosis terstruktur | Belum ada | Mapping teks → kode SATUSEHAT |
| Monitoring di status dialog | Belum ada | Tampilkan status di dialog encounter |

---

## 4. Alur Rawat Jalan (AMB)

### Kapan ClinicalImpression Dikirim

```
Pasien Datang
    │
    ▼
[1] Encounter (arrived → in-progress)           ← SUDAH IMPLEMENTASI
    │
    ▼
[2] Anamnesis & Pemeriksaan Fisik
    │   → Dokter mengisi anamnesis, periksa fisik
    │   → Data tersimpan di tabel Anamnesis & PhysicalExamination
    │
    ▼
[3] Observation (vital signs)                    ← SUDAH IMPLEMENTASI
    │
    ▼
[4] ★ ClinicalImpression: Riwayat Penyakit ★   ← AKAN DIBANGUN
    │   → Dikirim dari data DiagnosisSummary.clinical_impression
    │   → Kode: SNOMED 312850006 "History of disorder"
    │   → Berisi rangkuman anamnesis + riwayat perjalanan penyakit
    │
    ▼
[5] Condition (diagnosis ICD-10)                 ← SUDAH IMPLEMENTASI
    │
    ▼
[6] ★ ClinicalImpression: Rasional Klinis ★     ← AKAN DIBANGUN
    │   → Dikirim dari data AssessmentPlan.clinical_assessment
    │   → Kode: Kemkes TK000056 "Rasional Klinis"
    │   → Berisi alasan dokter menegakkan diagnosis
    │   → Bisa referensi ke Observation (pemeriksaan penunjang)
    │
    ▼
[7] ★ ClinicalImpression: Prognosis ★           ← AKAN DIBANGUN
    │   → Dikirim dari data AssessmentPlan.prognosis
    │   → Kode: Kemkes TK000057 "Prognosis"
    │   → Berisi prognosis: Baik (PRG001) / Sedang (PRG002) / Buruk (PRG003)
    │
    ▼
[8] MedicationRequest, Procedure, dll            ← SUDAH IMPLEMENTASI
    │
    ▼
[9] Encounter (finished)                         ← SUDAH IMPLEMENTASI
    │
    ▼
[10] Composition (resume medis)                  ← SUDAH IMPLEMENTASI
```

### Data yang Dipakai (Rawat Jalan)

| ClinicalImpression Type | Sumber Data | Field |
|--------------------------|-------------|-------|
| Riwayat Perjalanan Penyakit | `DiagnosisSummary` | `clinical_impression` |
| Rasional Klinis | `AssessmentPlan` | `clinical_assessment` |
| Prognosis | `AssessmentPlan` | `prognosis` |

---

## 5. Alur Rawat Inap (IMP)

### Kapan ClinicalImpression Dikirim

```
Pasien Masuk
    │
    ▼
[1] Location (bed occupied)                      ← SUDAH IMPLEMENTASI
    │
    ▼
[2] Encounter (arrived → in-progress)            ← SUDAH IMPLEMENTASI
    │
    ▼
[3] Anamnesis & Pemeriksaan Fisik Awal
    │
    ▼
[4] Observation (vital signs masuk)              ← SUDAH IMPLEMENTASI
    │
    ▼
[5] ★ ClinicalImpression: Riwayat Penyakit ★   ← AKAN DIBANGUN
    │   → Asesmen awal saat pasien masuk
    │   → Sumber: DiagnosisSummary.clinical_impression
    │
    ▼
[6] Condition (diagnosis masuk)                  ← SUDAH IMPLEMENTASI
    │
    ▼
    ┌─── PERAWATAN HARIAN (berulang) ───┐
    │                                     │
    │ [7] Observation (vital signs harian) │  ← SUDAH IMPLEMENTASI
    │ [8] MedicationRequest (obat harian)  │  ← SUDAH IMPLEMENTASI
    │ [9] MedicationDispense               │  ← SUDAH IMPLEMENTASI
    │ [10] MedicationAdministration         │  ← SUDAH IMPLEMENTASI
    │ [11] Consultation (SOAP, jika ada)   │
    │      → ClinicalImpression tambahan   │
    │        bisa dikirim per konsultasi   │
    │                                     │
    └─────────────────────────────────────┘
    │
    ▼
[12] ★ ClinicalImpression: Rasional Klinis ★    ← AKAN DIBANGUN
    │    → Asesmen akhir saat akan pulang
    │    → Sumber: AssessmentPlan.clinical_assessment
    │
    ▼
[13] ★ ClinicalImpression: Prognosis ★          ← AKAN DIBANGUN
    │    → Prognosis saat pulang
    │    → Sumber: AssessmentPlan.prognosis
    │
    ▼
[14] Condition (diagnosis keluar)                ← SUDAH IMPLEMENTASI
    │
    ▼
[15] Encounter (finished)                        ← SUDAH IMPLEMENTASI
    │
    ▼
[16] Location (bed unoccupied)
    │
    ▼
[17] Composition (resume medis)                  ← SUDAH IMPLEMENTASI
```

### Data Tambahan untuk Rawat Inap

| Data | Sumber | Keterangan |
|------|--------|------------|
| Asesmen harian | `Consultation.assessment` (SOAP) | Bisa dikirim sebagai ClinicalImpression tambahan |
| Progress notes | `Consultation` (SOAP per konsultasi) | Setiap konsultasi spesialis bisa 1 ClinicalImpression |

---

## 6. Alur IGD (EMER)

### Kapan ClinicalImpression Dikirim

```
Pasien Datang IGD
    │
    ▼
[1] Encounter (arrived)                          ← SUDAH IMPLEMENTASI
    │
    ▼
[2] TRIAGE
    │   → Perawat mengisi data triage
    │   → Level triage (ESI 1-5)
    │   → Primary survey (ABC)
    │   → GCS Score
    │   → Vital signs awal
    │
    ▼
[3] Observation (triage vital signs)             ← SUDAH IMPLEMENTASI
    │
    ▼
[4] ★ ClinicalImpression: Asesmen Triage ★      ← AKAN DIBANGUN (khusus IGD)
    │   → Sumber: Triage.triage_assessment
    │   → Kode: SNOMED 312850006 "History of disorder"
    │   → Berisi: level triage, kesan awal, GCS, consciousness
    │   → summary = triage_assessment + triage_level + consciousness
    │
    ▼
[5] Encounter (triaged → in-progress)
    │
    ▼
[6] Condition (keluhan utama)                    ← SUDAH IMPLEMENTASI
    │
    ▼
[7] Pemeriksaan Fisik & Penunjang (jika perlu)
    │
    ▼
[8] Observation (pemeriksaan lanjutan)           ← SUDAH IMPLEMENTASI
    │
    ▼
[9] ★ ClinicalImpression: Rasional Klinis ★     ← AKAN DIBANGUN
    │   → Sumber: AssessmentPlan.clinical_assessment
    │   → Alasan penegakan diagnosis di IGD
    │
    ▼
[10] Condition (diagnosis kerja/akhir)           ← SUDAH IMPLEMENTASI
    │
    ▼
[11] Procedure (tindakan emergensi)              ← SUDAH IMPLEMENTASI
    │
    ▼
[12] ★ ClinicalImpression: Prognosis ★          ← AKAN DIBANGUN
    │    → Prognosis pasien IGD
    │
    ▼
[13] MedicationRequest, MedicationDispense       ← SUDAH IMPLEMENTASI
    │
    ▼
[14] Encounter (finished)                        ← SUDAH IMPLEMENTASI
    │
    ▼
[15] Composition (resume medis)                  ← SUDAH IMPLEMENTASI
```

### Data Khusus IGD

| Data | Sumber | Keterangan |
|------|--------|------------|
| Level Triage | `Triage.triage_level` | ESI 1-5 → masuk di summary |
| Asesmen Triage | `Triage.triage_assessment` | Kesan awal perawat/dokter IGD |
| GCS | `Triage.gcse`, `gcsv`, `gcsm` | Glasgow Coma Scale → masuk di summary |
| Kesadaran | `Triage.consciousness` | Compos Mentis/Apatis/Somnolen/dll |
| Primary Survey | `Triage.airway`, `breathing`, `circulation` | ABC assessment |
| Tindakan Segera | `Triage.immediate_actions` | Tindakan emergensi yang dilakukan |

---

## 7. Jenis ClinicalImpression yang Akan Dibangun

### 7.1 Riwayat Perjalanan Penyakit

| Atribut | Nilai |
|---------|-------|
| **Kode** | SNOMED `312850006` - "History of disorder" |
| **Kapan dikirim** | Setelah anamnesis & pemeriksaan, sebelum diagnosis |
| **Sumber data** | `DiagnosisSummary.clinical_impression` + `Anamnesis` (keluhan, riwayat) |
| **Digunakan di** | Rawat Jalan, Rawat Inap (masuk), IGD |

### 7.2 Rasional Klinis

| Atribut | Nilai |
|---------|-------|
| **Kode** | Kemkes `TK000056` - "Rasional Klinis" |
| **Kapan dikirim** | Setelah diagnosis ditegakkan |
| **Sumber data** | `AssessmentPlan.clinical_assessment` |
| **Digunakan di** | Rawat Jalan, Rawat Inap (pulang), IGD |
| **Investigation** | Bisa referensi ke Observation (hasil penunjang) |

### 7.3 Prognosis

| Atribut | Nilai |
|---------|-------|
| **Kode** | Kemkes `TK000057` - "Prognosis" |
| **Kapan dikirim** | Setelah asesmen lengkap |
| **Sumber data** | `AssessmentPlan.prognosis` |
| **Digunakan di** | Rawat Jalan, Rawat Inap, IGD |
| **Kode prognosis** | `PRG001` (Baik), `PRG002` (Sedang), `PRG003` (Buruk) |

### 7.4 Asesmen Triage (Khusus IGD)

| Atribut | Nilai |
|---------|-------|
| **Kode** | SNOMED `312850006` - "History of disorder" (dengan konteks triage) |
| **Kapan dikirim** | Setelah triage selesai |
| **Sumber data** | `Triage.triage_assessment` + level + GCS + consciousness |
| **Digunakan di** | IGD saja |

---

## 8. Mapping Data SIMRS ke FHIR

### Field FHIR → Sumber Data SIMRS

| FHIR Field | Sumber SIMRS | Keterangan |
|------------|-------------|------------|
| `resourceType` | Fixed: `"ClinicalImpression"` | Konstanta |
| `status` | `"completed"` | Selalu completed saat dikirim |
| `code.coding` | Tergantung jenis (lihat section 7) | SNOMED/Kemkes code |
| `subject` | `Patient.SatuSehatID` | Referensi pasien |
| `encounter` | `Visit.SatuSehatEncounterID` | Referensi encounter |
| `effectiveDateTime` | `Visit.StartTime` atau `time.Now()` | Waktu asesmen |
| `date` | `time.Now()` | Waktu pencatatan |
| `assessor` | `Employee.SatuSehatID` (dokter) | Referensi praktisi penilai |
| `summary` | Berbeda per jenis (lihat tabel bawah) | Teks rangkuman |
| `investigation` | `Observation` IDs yang sudah dikirim | Referensi pemeriksaan penunjang |
| `finding` | `Diagnosis` (differential) | Temuan klinis |
| `prognosis` | `AssessmentPlan.prognosis` → kode | Kode prognosis Kemkes |

### Mapping Summary per Jenis

| Jenis | Field Summary | Contoh Isi |
|-------|--------------|------------|
| Riwayat Penyakit | `DiagnosisSummary.clinical_impression` | "Pasien datang dengan keluhan demam 3 hari, riwayat DM tipe 2..." |
| Rasional Klinis | `AssessmentPlan.clinical_assessment` | "Berdasarkan hasil lab dan klinis, mengarah ke DBD grade II..." |
| Prognosis | `AssessmentPlan.prognosis` | "Prognosis baik dengan terapi adekuat" |
| Asesmen Triage | `Triage.triage_assessment` + metadata | "ESI Level 2, GCS 15, kesadaran CM. Keluhan sesak napas akut..." |

### Mapping Prognosis (Teks → Kode)

| Teks di SIMRS | Kode Kemkes | Display |
|---------------|------------|---------|
| Mengandung "baik" / "good" | `PRG001` | Baik |
| Mengandung "sedang" / "dubia" | `PRG002` | Sedang |
| Mengandung "buruk" / "jelek" / "poor" | `PRG003` | Buruk |
| Default (tidak dikenali) | - | Kirim sebagai teks di summary saja |

---

## 9. Payload FHIR yang Akan Dikirim

### 9.1 Riwayat Perjalanan Penyakit

```json
{
  "resourceType": "ClinicalImpression",
  "status": "completed",
  "code": {
    "coding": [
      {
        "system": "http://snomed.info/sct",
        "code": "312850006",
        "display": "History of disorder"
      }
    ]
  },
  "subject": {
    "reference": "Patient/{IHS_Number}",
    "display": "Nama Pasien"
  },
  "encounter": {
    "reference": "Encounter/{Encounter_ID}"
  },
  "effectiveDateTime": "2026-01-28T10:00:00+07:00",
  "date": "2026-01-28T10:00:00+07:00",
  "assessor": {
    "reference": "Practitioner/{Practitioner_IHS}"
  },
  "summary": "Pasien datang dengan keluhan utama demam menggigil 3 hari disertai sakit kepala. Riwayat DM tipe 2 (+). Riwayat keluarga: ibu dengan DM tipe 2."
}
```

### 9.2 Rasional Klinis

```json
{
  "resourceType": "ClinicalImpression",
  "status": "completed",
  "code": {
    "coding": [
      {
        "system": "http://terminology.kemkes.go.id",
        "code": "TK000056",
        "display": "Rasional Klinis"
      }
    ]
  },
  "subject": {
    "reference": "Patient/{IHS_Number}",
    "display": "Nama Pasien"
  },
  "encounter": {
    "reference": "Encounter/{Encounter_ID}"
  },
  "effectiveDateTime": "2026-01-28T10:30:00+07:00",
  "date": "2026-01-28T10:30:00+07:00",
  "assessor": {
    "reference": "Practitioner/{Practitioner_IHS}"
  },
  "investigation": [
    {
      "code": {
        "coding": [
          {
            "system": "http://snomed.info/sct",
            "code": "271336007",
            "display": "Examination / signs"
          }
        ]
      },
      "item": [
        {
          "reference": "Observation/{Observation_ID}",
          "display": "Hasil Pemeriksaan"
        }
      ]
    }
  ],
  "summary": "Berdasarkan anamnesis dan pemeriksaan fisik, pasien menunjukkan gejala ISPA. Hasil lab menunjukkan leukosit normal, CRP meningkat ringan. Diagnosis mengarah ke J06.9."
}
```

### 9.3 Prognosis

```json
{
  "resourceType": "ClinicalImpression",
  "status": "completed",
  "code": {
    "coding": [
      {
        "system": "http://terminology.kemkes.go.id",
        "code": "TK000057",
        "display": "Prognosis"
      }
    ]
  },
  "subject": {
    "reference": "Patient/{IHS_Number}",
    "display": "Nama Pasien"
  },
  "encounter": {
    "reference": "Encounter/{Encounter_ID}"
  },
  "effectiveDateTime": "2026-01-28T10:30:00+07:00",
  "date": "2026-01-28T10:30:00+07:00",
  "assessor": {
    "reference": "Practitioner/{Practitioner_IHS}"
  },
  "prognosis": [
    {
      "coding": [
        {
          "system": "http://terminology.kemkes.go.id",
          "code": "PRG001",
          "display": "Baik"
        }
      ]
    }
  ],
  "summary": "Prognosis baik, pasien responsif terhadap terapi simtomatik"
}
```

---

## 10. Rencana Teknis Implementasi

### File yang Akan Diubah / Dibuat

#### Backend

| # | File | Perubahan |
|---|------|-----------|
| 1 | `models/medical_record.go` | Tambah field `SatusehatClinicalImpressionID` di `DiagnosisSummary` dan `AssessmentPlan` |
| 2 | `handlers/satusehat_fhir.go` | Tambah struct `FHIRClinicalImpression`, `FHIRClinicalImpressionInvestigation` |
| 3 | `handlers/satusehat_fhir.go` | Tambah fungsi `BuildFHIRClinicalImpression()` untuk 3 jenis + triage |
| 4 | `handlers/satusehat_fhir.go` | Tambah handler `SendClinicalImpressionToSatuSehat()` |
| 5 | `handlers/satusehat_monitoring.go` | Tambah ClinicalImpression ke status monitoring |
| 6 | `routes/integrations.go` | Tambah route `POST /clinical-impression/:id/send` |

#### Frontend

| # | File | Perubahan |
|---|------|-----------|
| 7 | `lib/api/integrations.ts` | Tambah method `sendClinicalImpression()` |
| 8 | `pages/integrations/satusehat-sender.tsx` | Tambah handler + button di status dialog |

### Struct yang Akan Dibuat

```go
type FHIRClinicalImpression struct {
    ResourceType      string                                `json:"resourceType"`
    Status            string                                `json:"status"`
    Code              *FHIRCodeableConcept                  `json:"code"`
    Subject           *FHIRReference                        `json:"subject"`
    Encounter         *FHIRReference                        `json:"encounter"`
    EffectiveDateTime string                                `json:"effectiveDateTime"`
    Date              string                                `json:"date"`
    Assessor          *FHIRReference                        `json:"assessor,omitempty"`
    Investigation     []FHIRClinicalImpressionInvestigation `json:"investigation,omitempty"`
    Summary           string                                `json:"summary,omitempty"`
    Finding           []FHIRClinicalImpressionFinding       `json:"finding,omitempty"`
    Prognosis         []FHIRCodeableConcept                 `json:"prognosis,omitempty"`
}

type FHIRClinicalImpressionInvestigation struct {
    Code *FHIRCodeableConcept `json:"code"`
    Item []FHIRReference      `json:"item,omitempty"`
}

type FHIRClinicalImpressionFinding struct {
    ItemCodeableConcept *FHIRCodeableConcept `json:"itemCodeableConcept,omitempty"`
    ItemReference       *FHIRReference       `json:"itemReference,omitempty"`
}
```

### Handler Flow

```
1. Terima request POST /clinical-impression/:visitId/send?type=history|rationale|prognosis|triage
2. Load Visit + Patient + Doctor + DiagnosisSummary + AssessmentPlan + Triage (jika IGD)
3. Validasi prasyarat (IHS Number, Encounter ID)
4. Pilih data berdasarkan type parameter
5. Build FHIR payload
6. Kirim ke SatuSehat via SatuSehatFHIRRequest("POST", "/ClinicalImpression", payload)
7. Simpan ID response ke database
8. Return response ke frontend
```

### Database Field Baru

```go
// Di DiagnosisSummary - untuk Riwayat Perjalanan Penyakit
SatusehatClinicalImpressionHistoryID string `gorm:"size:100" json:"satusehat_ci_history_id,omitempty"`

// Di AssessmentPlan - untuk Rasional Klinis & Prognosis
SatusehatClinicalImpressionRationaleID string `gorm:"size:100" json:"satusehat_ci_rationale_id,omitempty"`
SatusehatClinicalImpressionPrognosisID string `gorm:"size:100" json:"satusehat_ci_prognosis_id,omitempty"`

// Di Triage - untuk Asesmen Triage (IGD)
SatusehatClinicalImpressionTriageID string `gorm:"size:100" json:"satusehat_ci_triage_id,omitempty"`
```

### Route Baru

```go
// Send clinical impression to SatuSehat
// type: history, rationale, prognosis, triage
satusehat.POST("/clinical-impression/:id/send", handlers.SendClinicalImpressionToSatuSehat)
```

### Frontend API

```typescript
sendClinicalImpression: (visitId: number, type: 'history' | 'rationale' | 'prognosis' | 'triage') =>
    api.post<{
      message: string;
      satusehat_clinical_impression_id: string;
      type: string;
      fhir_response: any;
    }>(`/integrations/satusehat/clinical-impression/${visitId}/send`, { type }),
```

---

## Catatan Penting

1. **ClinicalImpression bisa lebih dari 1 per kunjungan** - berbeda dengan Encounter/Composition yang 1:1. Satu kunjungan bisa punya hingga 4 ClinicalImpression (history + rationale + prognosis + triage untuk IGD).

2. **Data sudah lengkap di SIMRS** - Semua field yang dibutuhkan sudah dikumpulkan lewat form rekam medis (diagnosis form, assessment plan form, triage form). Tidak perlu menambah form baru.

3. **Prognosis perlu mapping kode** - Field prognosis saat ini berupa teks bebas. Perlu logic untuk mapping ke kode Kemkes (PRG001/PRG002/PRG003) atau tambahkan dropdown di form assessment plan.

4. **Investigation bersifat opsional** - Referensi ke Observation (pemeriksaan penunjang) dikirim jika sudah ada Observation yang terkirim ke SATUSEHAT.
