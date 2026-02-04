# SatuSehat Diagnosis Bridging - Skema dan Alur Proses

## Latar Belakang

SatuSehat mewajibkan data **Diagnosis (FHIR Condition)** untuk setiap **Encounter** yang dikirim. Berdasarkan error:

```json
{
  "issue": [{
    "code": "value",
    "details": {
      "text": "Element not found: Encounter.diagnosis (RuleNumber: 10457)"
    },
    "expression": ["Encounter.diagnosis"]
  }]
}
```

Encounter tidak bisa dikirim tanpa referensi ke Condition (diagnosis).

---

## Skema Database

### Tabel Existing

```
┌────────────────────┐     ┌────────────────────┐     ┌────────────────────┐
│       visits       │     │     diagnoses      │     │       icd10        │
├────────────────────┤     ├────────────────────┤     ├────────────────────┤
│ id                 │◄────│ visit_id           │     │ code               │
│ visit_number       │     │ id                 │     │ display            │
│ status             │     │ icd10_code         │─────│ valid_code         │
│ satusehat_enc_id   │     │ icd10_name         │     │ acc_pdx            │
│ satusehat_sync_st  │     │ type (primary/sec) │     └────────────────────┘
│ ...                │     │ clinical_status    │
└────────────────────┘     │ verification_stat  │
                           │ satusehat_cond_id  │◄── BARU: SatuSehat Condition ID
                           │ satusehat_sent_at  │◄── BARU: Timestamp kirim
                           └────────────────────┘
```

### Field Baru pada `diagnoses`

| Field | Type | Description |
|-------|------|-------------|
| `satusehat_condition_id` | string(100) | ID Condition dari SatuSehat |
| `satusehat_sent_at` | timestamp | Waktu berhasil dikirim |

---

## Alur Proses Bridging

### Diagram Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           SATUSEHAT ENCOUNTER BRIDGING FLOW                          │
└─────────────────────────────────────────────────────────────────────────────────────┘

                                    ┌─────────────────┐
                                    │   User Click    │
                                    │  "Kirim Visit"  │
                                    └────────┬────────┘
                                             │
                                             ▼
                          ┌──────────────────────────────────────┐
                          │         VALIDASI SYARAT KIRIM        │
                          │                                      │
                          │  ✓ Pasien punya IHS Number           │
                          │  ✓ Dokter punya IHS Number           │
                          │  ✓ Ruangan punya SatuSehat ID        │
                          │  ✓ Visit punya minimal 1 Diagnosis   │◄── BARU
                          │    (Primary Diagnosis wajib)         │
                          └────────────────┬─────────────────────┘
                                           │
                              Semua Valid? │
                    ┌──────────────────────┼──────────────────────┐
                    │ TIDAK                │                      │
                    ▼                      ▼                      │
          ┌─────────────────┐    ┌─────────────────────┐         │
          │  Tampilkan      │    │  LANGKAH 1:         │         │
          │  Error Message  │    │  Kirim Condition    │         │
          │  dengan syarat  │    │  (Diagnosis) dulu   │         │
          │  yang belum     │    └──────────┬──────────┘         │
          │  terpenuhi      │               │                     │
          └─────────────────┘               ▼                     │
                                  ┌─────────────────────┐         │
                                  │ Untuk setiap        │         │
                                  │ Diagnosis di Visit: │         │
                                  │                     │         │
                                  │ ┌─────────────────┐ │         │
                                  │ │ Build FHIR      │ │         │
                                  │ │ Condition       │ │         │
                                  │ │ - ICD-10 Code   │ │         │
                                  │ │ - Patient ref   │ │         │
                                  │ │ - Clinical stat │ │         │
                                  │ └────────┬────────┘ │         │
                                  │          │          │         │
                                  │          ▼          │         │
                                  │ ┌─────────────────┐ │         │
                                  │ │ POST /Condition │ │         │
                                  │ │ ke SatuSehat    │ │         │
                                  │ └────────┬────────┘ │         │
                                  │          │          │         │
                                  │          ▼          │         │
                                  │ ┌─────────────────┐ │         │
                                  │ │ Simpan          │ │         │
                                  │ │ condition_id    │ │         │
                                  │ │ ke database     │ │         │
                                  │ └─────────────────┘ │         │
                                  └──────────┬──────────┘         │
                                             │                     │
                                             ▼                     │
                                  ┌─────────────────────┐         │
                                  │  LANGKAH 2:         │         │
                                  │  Kirim Encounter    │         │
                                  │  dengan Diagnosis   │         │
                                  └──────────┬──────────┘         │
                                             │                     │
                                             ▼                     │
                                  ┌─────────────────────┐         │
                                  │ Build FHIR          │         │
                                  │ Encounter dengan:   │         │
                                  │                     │         │
                                  │ diagnosis: [        │         │
                                  │   {                 │         │
                                  │     condition: {    │         │
                                  │       reference:    │         │
                                  │       "Condition/   │         │
                                  │        {cond_id}"   │         │
                                  │     },              │         │
                                  │     use: {          │         │
                                  │       coding: [{    │         │
                                  │         code: "DD"  │◄─ Primary
                                  │       }]            │   atau "CC"
                                  │     },              │   Secondary
                                  │     rank: 1         │         │
                                  │   }                 │         │
                                  │ ]                   │         │
                                  └──────────┬──────────┘         │
                                             │                     │
                                             ▼                     │
                                  ┌─────────────────────┐         │
                                  │ POST /Encounter     │         │
                                  │ ke SatuSehat        │         │
                                  └──────────┬──────────┘         │
                                             │                     │
                                             ▼                     │
                                  ┌─────────────────────┐         │
                                  │ Success?            │         │
                                  │                     │         │
                                  │ ✓ Simpan enc_id    │         │
                                  │ ✓ Update status    │         │
                                  │   "sent"            │         │
                                  └─────────────────────┘         │
                                             │                     │
                                             ▼                     │
                                  ┌─────────────────────┐         │
                                  │    SELESAI ✓        │         │
                                  └─────────────────────┘         │
```

---

## Struktur FHIR

### 1. FHIR Condition (Diagnosis)

```json
{
  "resourceType": "Condition",
  "clinicalStatus": {
    "coding": [{
      "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
      "code": "active",
      "display": "Active"
    }]
  },
  "category": [{
    "coding": [{
      "system": "http://terminology.hl7.org/CodeSystem/condition-category",
      "code": "encounter-diagnosis",
      "display": "Encounter Diagnosis"
    }]
  }],
  "code": {
    "coding": [{
      "system": "http://hl7.org/fhir/sid/icd-10",
      "code": "A00.1",
      "display": "Cholera due to Vibrio cholerae 01, biovar eltor"
    }]
  },
  "subject": {
    "reference": "Patient/100000030009",
    "display": "Nama Pasien"
  },
  "encounter": {
    "reference": "Encounter/{{Encounter_uuid}}",
    "display": "Kunjungan VIS2026011010001"
  },
  "onsetDateTime": "2026-01-20T10:00:00+07:00",
  "recordedDate": "2026-01-20T10:30:00+07:00"
}
```

### 2. FHIR Encounter dengan Diagnosis

```json
{
  "resourceType": "Encounter",
  "identifier": [{
    "system": "http://sys-ids.kemkes.go.id/encounter/{{org_id}}",
    "value": "VIS2026011010001"
  }],
  "status": "finished",
  "class": {
    "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
    "code": "AMB",
    "display": "ambulatory"
  },
  "subject": {
    "reference": "Patient/100000030009",
    "display": "Nama Pasien"
  },
  "participant": [{
    "type": [{
      "coding": [{
        "system": "http://terminology.hl7.org/CodeSystem/v3-ParticipationType",
        "code": "ATND",
        "display": "attender"
      }]
    }],
    "individual": {
      "reference": "Practitioner/N10000001",
      "display": "dr. Nama Dokter"
    }
  }],
  "period": {
    "start": "2026-01-20T10:00:00+07:00",
    "end": "2026-01-20T10:30:00+07:00"
  },
  "location": [{
    "location": {
      "reference": "Location/{{location_id}}",
      "display": "Poli Umum"
    }
  }],
  "diagnosis": [
    {
      "condition": {
        "reference": "Condition/{{condition_uuid}}",
        "display": "A00.1 - Cholera due to Vibrio cholerae"
      },
      "use": {
        "coding": [{
          "system": "http://terminology.hl7.org/CodeSystem/diagnosis-role",
          "code": "DD",
          "display": "Discharge diagnosis"
        }]
      },
      "rank": 1
    },
    {
      "condition": {
        "reference": "Condition/{{secondary_condition_uuid}}",
        "display": "B01.0 - Secondary diagnosis"
      },
      "use": {
        "coding": [{
          "system": "http://terminology.hl7.org/CodeSystem/diagnosis-role",
          "code": "CC",
          "display": "Chief complaint"
        }]
      },
      "rank": 2
    }
  ],
  "serviceProvider": {
    "reference": "Organization/{{org_id}}"
  }
}
```

---

## Kode Diagnosis Role

| Code | Display | Penggunaan |
|------|---------|------------|
| `DD` | Discharge diagnosis | Diagnosis utama (primary) |
| `CC` | Chief complaint | Diagnosis sekunder/keluhan utama |
| `CM` | Comorbidity diagnosis | Komorbiditas |
| `AD` | Admission diagnosis | Diagnosis masuk (rawat inap) |
| `pre-op` | Pre-op diagnosis | Diagnosis pre-operasi |
| `post-op` | Post-op diagnosis | Diagnosis post-operasi |

---

## Implementasi Backend

### 1. Update Model Diagnosis

```go
// Di models/medical_record.go
type Diagnosis struct {
    // ... existing fields ...
    
    // SatuSehat Integration
    SatuSehatConditionID string     `gorm:"size:100" json:"satusehat_condition_id,omitempty"`
    SatuSehatSentAt      *time.Time `json:"satusehat_sent_at,omitempty"`
}
```

### 2. Update FHIR Encounter Structure

```go
// Di handlers/satusehat_fhir.go

// FHIREncounterDiagnosis untuk referensi Condition
type FHIREncounterDiagnosis struct {
    Condition *FHIRReference       `json:"condition"`
    Use       *FHIRCodeableConcept `json:"use,omitempty"`
    Rank      int                  `json:"rank,omitempty"`
}

// Update FHIREncounter
type FHIREncounter struct {
    // ... existing fields ...
    Diagnosis []FHIREncounterDiagnosis `json:"diagnosis,omitempty"` // BARU
}
```

### 3. API Endpoints Baru

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/api/satusehat/condition/:id/send` | Kirim Condition (diagnosis) |
| POST | `/api/satusehat/encounter/:id/send-with-diagnosis` | Kirim Encounter + auto-send Conditions |

---

## Implementasi Frontend

### Syarat Kirim yang Diupdate

```tsx
// Di satusehat-sender.tsx - visitColumns
const patientHasIHS = !!visit.registration?.patient?.satusehat_id;
const doctorHasIHS = !!visit.doctor?.satusehat_id;
const roomHasSatuSehat = !!visit.room?.satusehat_id;
const hasDiagnosis = (visit.diagnoses?.length ?? 0) > 0;  // BARU
const hasPrimaryDiagnosis = visit.diagnoses?.some(d => d.type === 'primary'); // BARU

const allReady = patientHasIHS && doctorHasIHS && roomHasSatuSehat && hasPrimaryDiagnosis;
```

### UI Tambahan

```
┌─────────────────────────────────────────────────────────────────┐
│  Syarat Kirim                                                   │
│                                                                 │
│  ✓ Pasien IHS         IHS: 100000030009                        │
│  ✓ Dokter IHS         IHS: N10000001                           │
│  ✓ Ruangan            ID: loc-xxx-xxx                          │
│  ✗ Diagnosis Utama    Belum ada diagnosis (wajib)  ◄── BARU    │
│                                                                 │
│  [Kirim]  ← disabled jika tidak lengkap                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Langkah Implementasi

1. **Database Migration**: Tambah field `satusehat_condition_id` dan `satusehat_sent_at` ke tabel `diagnoses`

2. **Update Model**: Tambah field di `models/medical_record.go`

3. **Update FHIR Structure**: 
   - Tambah `FHIREncounterDiagnosis` struct
   - Update `FHIREncounter` dengan field `Diagnosis`
   - Update `BuildFHIREncounter` untuk include diagnosis

4. **Handler Baru**: 
   - `SendConditionToSatuSehat` - Kirim individual Condition
   - Update `SendEncounterToSatuSehat` - Auto-send Conditions lalu Encounter

5. **Route Baru**: Register endpoints di `routes/satusehat.go`

6. **Frontend Update**:
   - Update `Visit` interface dengan `diagnoses` field
   - Update syarat kirim untuk validasi diagnosis
   - Update UI indicator

---

## Catatan Penting

1. **Urutan Pengiriman**:
   - Condition **HARUS** dikirim terlebih dahulu sebelum Encounter
   - Encounter hanya bisa reference Condition yang sudah ada di SatuSehat

2. **Primary Diagnosis Wajib**:
   - Minimal 1 diagnosis dengan type `primary` harus ada
   - SatuSehat memvalidasi keberadaan diagnosis utama

3. **ICD-10 Validation**:
   - Kode ICD-10 harus valid dan terdaftar di SatuSehat
   - Gunakan field `valid_code = true` dari tabel icd10

4. **Error Handling**:
   - Jika Condition gagal, jangan lanjut ke Encounter
   - Rollback status jika Encounter gagal setelah Conditions terkirim
