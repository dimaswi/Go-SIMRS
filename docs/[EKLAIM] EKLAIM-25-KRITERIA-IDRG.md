# 25 Kriteria Pengembangan Sistem IT Uji Coba iDRG

Dokumen ini berisi kriteria yang harus dipenuhi sistem IT Rumah Sakit untuk implementasi iDRG (Indonesian Diagnosis Related Groups).

---

## Overview

iDRG adalah pengembangan dari sistem INA-CBG yang lebih akurat dalam menghitung tarif berdasarkan:
1. Diagnosis yang lebih spesifik
2. Prosedur yang terukur
3. Severity level yang lebih granular
4. Faktor-faktor khusus (ICU, Ventilator, dll)

---

## 25 Kriteria Utama

### Kriteria 1: Nomor SEP Valid

**Deskripsi:**
Setiap klaim harus memiliki nomor SEP (Surat Eligibilitas Peserta) yang valid.

**Validasi:**
```go
func validateSEP(sep string) error {
    if sep == "" {
        return errors.New("Nomor SEP wajib diisi")
    }
    if len(sep) < 15 || len(sep) > 20 {
        return errors.New("Format nomor SEP tidak valid")
    }
    // Pattern: PPPPPPPPRRRRNNNNNN
    // P = Kode PPK (8 digit)
    // R = Region/Cabang (4 digit) 
    // N = Nomor urut (6+ digit)
    return nil
}
```

**UI Validation:**
- Input mask: `________-____-______`
- Real-time validation saat input
- Tombol "Cek SEP" untuk verifikasi ke VClaim (jika terintegrasi)

---

### Kriteria 2: Tanggal Masuk & Pulang Valid

**Deskripsi:**
Tanggal masuk dan pulang harus logis dan dalam format yang benar.

**Validasi:**
```go
func validateDates(masuk, pulang time.Time, jenisRawat string) []error {
    var errors []error
    
    // Tanggal pulang tidak boleh sebelum masuk
    if pulang.Before(masuk) {
        errors = append(errors, fmt.Errorf("Tanggal pulang tidak boleh sebelum tanggal masuk"))
    }
    
    // LOS minimal 1 hari untuk rawat inap
    if jenisRawat == "1" { // Rawat Inap
        los := int(pulang.Sub(masuk).Hours() / 24)
        if los < 1 {
            errors = append(errors, fmt.Errorf("LOS rawat inap minimal 1 hari"))
        }
    }
    
    // Tidak boleh tanggal masa depan
    if pulang.After(time.Now()) {
        errors = append(errors, fmt.Errorf("Tanggal pulang tidak boleh di masa depan"))
    }
    
    // Tidak boleh lebih dari 2 tahun yang lalu
    twoYearsAgo := time.Now().AddDate(-2, 0, 0)
    if masuk.Before(twoYearsAgo) {
        errors = append(errors, fmt.Errorf("Tanggal masuk terlalu lama (>2 tahun)"))
    }
    
    return errors
}
```

**LOS (Length of Stay) Guidelines:**

| Jenis Rawat | LOS Min | LOS Max | Catatan |
|-------------|---------|---------|---------|
| Rawat Jalan | 0 | 0 | Same day |
| Rawat Inap | 1 | 365 | >30 hari perlu review |
| IGD | 0 | 1 | <24 jam |

---

### Kriteria 3: Diagnosis Utama Valid (ICD-10)

**Deskripsi:**
Diagnosis utama harus menggunakan kode ICD-10 yang valid dan sesuai.

**Validasi:**
```go
func validatePrimaryDiagnosis(code string) []error {
    var errors []error
    
    // Cek format ICD-10
    if !isValidICD10Format(code) {
        errors = append(errors, fmt.Errorf("Format kode diagnosis tidak valid"))
    }
    
    // Kode Z tidak boleh sebagai diagnosis utama
    if strings.HasPrefix(code, "Z") {
        errors = append(errors, fmt.Errorf("Kode Z tidak boleh sebagai diagnosis utama"))
    }
    
    // Kode U tidak boleh sebagai diagnosis utama  
    if strings.HasPrefix(code, "U") {
        errors = append(errors, fmt.Errorf("Kode U tidak boleh sebagai diagnosis utama"))
    }
    
    // Kode morfologi (M) tidak boleh sebagai diagnosis utama
    if strings.HasPrefix(code, "M") && len(code) > 4 {
        errors = append(errors, fmt.Errorf("Kode morfologi tidak boleh sebagai diagnosis utama"))
    }
    
    return errors
}
```

**Kode yang TIDAK BOLEH sebagai Diagnosis Utama:**

| Prefix | Deskripsi | Contoh |
|--------|-----------|--------|
| Z | Factors influencing health | Z00-Z99 |
| U | Codes for special purposes | U00-U99 |
| Y | External causes morbidity/mortality | Y40-Y84 |
| M8xxx | Morphology neoplasms | M8000-M9999 |

---

### Kriteria 4: Diagnosis Sekunder Relevan

**Deskripsi:**
Diagnosis sekunder harus relevan dengan diagnosis utama dan maksimal 10 kode.

**Validasi:**
```go
func validateSecondaryDiagnoses(primary string, secondaries []string) []error {
    var errors []error
    
    // Maksimal 10 diagnosis sekunder
    if len(secondaries) > 10 {
        errors = append(errors, fmt.Errorf("Maksimal 10 diagnosis sekunder"))
    }
    
    // Tidak boleh duplikat
    seen := make(map[string]bool)
    for _, code := range secondaries {
        if seen[code] {
            errors = append(errors, fmt.Errorf("Diagnosis duplikat: %s", code))
        }
        seen[code] = true
    }
    
    // Tidak boleh sama dengan diagnosis utama
    for _, code := range secondaries {
        if code == primary {
            errors = append(errors, fmt.Errorf("Diagnosis sekunder tidak boleh sama dengan utama"))
        }
    }
    
    return errors
}
```

**Rekomendasi Diagnosis Sekunder:**
1. Komorbid yang mempengaruhi perawatan
2. Komplikasi selama perawatan
3. Kondisi kronis yang memerlukan penanganan

---

### Kriteria 5: Prosedur Valid (ICD-9-CM)

**Deskripsi:**
Prosedur harus menggunakan kode ICD-9-CM yang valid.

**Validasi:**
```go
func validateProcedures(procedures []string) []error {
    var errors []error
    
    for _, code := range procedures {
        // Format ICD-9-CM: XX.XX atau XXX.XX
        if !isValidICD9CMFormat(code) {
            errors = append(errors, fmt.Errorf("Format prosedur tidak valid: %s", code))
        }
        
        // Cek apakah kode ada di database
        if !existsInICD9CM(code) {
            errors = append(errors, fmt.Errorf("Kode prosedur tidak ditemukan: %s", code))
        }
    }
    
    return errors
}

func isValidICD9CMFormat(code string) bool {
    // Pattern: 2-3 digit . 1-2 digit
    pattern := regexp.MustCompile(`^\d{2,3}\.\d{1,2}$`)
    return pattern.MatchString(code)
}
```

---

### Kriteria 6: Kelas Rawat Sesuai Hak

**Deskripsi:**
Kelas rawat harus sesuai dengan hak peserta BPJS.

**Validasi:**
```go
func validateKelasRawat(kelas string, hakPeserta string) error {
    kelasInt, _ := strconv.Atoi(kelas)
    hakInt, _ := strconv.Atoi(hakPeserta)
    
    // Tidak boleh melebihi hak
    if kelasInt < hakInt {
        return fmt.Errorf("Kelas rawat (%d) melebihi hak peserta (%d)", kelasInt, hakInt)
    }
    
    return nil
}
```

**Kelas Rawat:**
- 1 = Kelas 1 (VIP)
- 2 = Kelas 2
- 3 = Kelas 3

---

### Kriteria 7: Cara Masuk Valid

**Deskripsi:**
Cara masuk pasien harus sesuai dengan kondisi sebenarnya.

**Mapping:**

| Kode | Deskripsi | Kondisi |
|------|-----------|---------|
| 1 | IGD | Pasien masuk via IGD |
| 2 | Poliklinik | Pasien masuk via poli/admisi |
| 3 | Rujukan Langsung | Rujukan dari RS lain |
| 4 | Bayi Lahir di RS | Neonatus lahir di RS |

**Validasi:**
```go
func validateCaraMasuk(caraMasuk string, serviceType string) error {
    switch caraMasuk {
    case "1": // IGD
        if serviceType != "gawat_darurat" {
            return fmt.Errorf("Cara masuk IGD tidak sesuai dengan tipe layanan")
        }
    case "4": // Bayi lahir
        // Harus ada diagnosis P (Perinatal)
    }
    return nil
}
```

---

### Kriteria 8: Discharge Status Valid

**Deskripsi:**
Status pulang harus mencerminkan kondisi akhir pasien.

**Mapping:**

| Kode | Deskripsi | Validasi |
|------|-----------|----------|
| 1 | Pulang atas persetujuan dokter | Default |
| 2 | Pulang paksa | Perlu catatan |
| 3 | Pulang atas permintaan sendiri | Perlu tandatangan |
| 4 | Meninggal | Perlu surat kematian |
| 5 | Rujuk keluar | Perlu surat rujukan |

---

### Kriteria 9: Tarif RS Harus > 0

**Deskripsi:**
Tarif rumah sakit yang diajukan harus lebih dari 0.

**Validasi:**
```go
func validateTarifRS(tarif float64) error {
    if tarif <= 0 {
        return fmt.Errorf("Tarif RS harus lebih dari 0")
    }
    
    // Warning jika tarif terlalu rendah
    if tarif < 100000 {
        log.Warn("Tarif RS sangat rendah, perlu review")
    }
    
    return nil
}
```

---

### Kriteria 10: Berat Lahir untuk Neonatus

**Deskripsi:**
Berat lahir WAJIB diisi untuk kasus neonatus.

**Validasi:**
```go
func validateBirthWeight(birthWeight int, diagnoses []string) error {
    isNeonatal := false
    for _, dx := range diagnoses {
        if strings.HasPrefix(dx, "P") {
            isNeonatal = true
            break
        }
    }
    
    if isNeonatal && birthWeight == 0 {
        return fmt.Errorf("Berat lahir wajib diisi untuk kasus neonatus")
    }
    
    if birthWeight > 0 {
        if birthWeight < 500 {
            return fmt.Errorf("Berat lahir tidak realistis (<500 gram)")
        }
        if birthWeight > 7000 {
            return fmt.Errorf("Berat lahir tidak realistis (>7000 gram)")
        }
    }
    
    return nil
}
```

**Kategori Berat Lahir:**
- BBLSR: < 1000 gram
- BBLR: 1000 - 2499 gram
- Normal: 2500 - 4000 gram
- Makrosomia: > 4000 gram

---

### Kriteria 11: ICU Indicator

**Deskripsi:**
Jika pasien dirawat di ICU, indicator ICU harus diisi.

**Field Terkait:**
```go
type ICUData struct {
    ICUIndikator   string  // "0" atau "1"
    ICULOS         int     // Lama rawat ICU (hari)
    VentilatorHour int     // Jam penggunaan ventilator
    Ventilator     string  // "0" atau "1"
    SpecialICU     string  // "IC", "ICCU", "PICU", "NICU", dll
}
```

**Validasi:**
```go
func validateICU(data ICUData) []error {
    var errors []error
    
    if data.ICUIndikator == "1" {
        if data.ICULOS == 0 {
            errors = append(errors, fmt.Errorf("ICU LOS wajib diisi jika ada perawatan ICU"))
        }
        if data.SpecialICU == "" {
            errors = append(errors, fmt.Errorf("Tipe ICU wajib diisi"))
        }
    }
    
    if data.Ventilator == "1" {
        if data.VentilatorHour == 0 {
            errors = append(errors, fmt.Errorf("Jam ventilator wajib diisi"))
        }
    }
    
    return errors
}
```

---

### Kriteria 12: Ventilator Hours

**Deskripsi:**
Jam penggunaan ventilator harus diisi jika menggunakan ventilator.

**Konversi:**
```go
func convertVentilatorHours(startTime, endTime time.Time) int {
    duration := endTime.Sub(startTime)
    hours := int(duration.Hours())
    
    // Minimal 1 jam
    if hours < 1 {
        return 1
    }
    
    return hours
}
```

---

### Kriteria 13: Upgrade Class

**Deskripsi:**
Jika pasien naik kelas dari hak, harus ada indikator upgrade.

**Field:**
```go
type UpgradeClass struct {
    Indicator string // "0" atau "1"
    Class     string // Kelas yang dinaiki
    LOS       int    // Hari di kelas tersebut
}
```

---

### Kriteria 14: ADL Score untuk Subacute/Chronic

**Deskripsi:**
ADL (Activities of Daily Living) score untuk pasien subacute atau chronic.

**Range:**
- Subacute: 0-100
- Chronic: 0-100

---

### Kriteria 15: NIK Coder 16 Digit

**Deskripsi:**
NIK petugas coder harus valid 16 digit.

**Validasi:**
```go
func validateCoderNIK(nik string) error {
    if len(nik) != 16 {
        return fmt.Errorf("NIK Coder harus 16 digit")
    }
    
    // Validasi format
    if _, err := strconv.ParseInt(nik, 10, 64); err != nil {
        return fmt.Errorf("NIK harus berupa angka")
    }
    
    return nil
}
```

---

### Kriteria 16: Konsistensi Diagnosis-Prosedur

**Deskripsi:**
Diagnosis harus relevan dengan prosedur yang dilakukan.

**Contoh Konsistensi:**

| Diagnosis | Prosedur yang Relevan |
|-----------|----------------------|
| K35.x (Appendicitis) | 47.xx (Appendectomy) |
| K80.x (Cholelithiasis) | 51.xx (Cholecystectomy) |
| O80 (Normal delivery) | 73.xx (Delivery procedures) |
| S72.x (Fracture femur) | 79.xx (Reduction fracture) |

**Validasi:**
```go
var diagnosisProcedureMapping = map[string][]string{
    "K35": {"47.01", "47.09", "47.2"},  // Appendicitis -> Appendectomy
    "K80": {"51.22", "51.23", "51.24"}, // Cholecystitis -> Cholecystectomy
    // ... more mappings
}

func validateConsistency(diagnoses, procedures []string) []string {
    var warnings []string
    
    for _, dx := range diagnoses {
        prefix := dx[:3]
        expectedProcs := diagnosisProcedureMapping[prefix]
        
        if len(expectedProcs) > 0 {
            hasMatch := false
            for _, proc := range procedures {
                for _, expected := range expectedProcs {
                    if strings.HasPrefix(proc, expected[:2]) {
                        hasMatch = true
                        break
                    }
                }
            }
            if !hasMatch {
                warnings = append(warnings, 
                    fmt.Sprintf("Diagnosis %s biasanya memerlukan prosedur terkait", dx))
            }
        }
    }
    
    return warnings
}
```

---

### Kriteria 17: Severity Level

**Deskripsi:**
Severity level dihitung otomatis berdasarkan diagnosis dan prosedur.

**Level:**
- Level 0: Rawat Jalan
- Level I: Ringan
- Level II: Sedang
- Level III: Berat

---

### Kriteria 18: LOS Sesuai Standar

**Deskripsi:**
Length of Stay tidak boleh melebihi standar tanpa justifikasi.

**Warning:**
```go
var standardLOS = map[string]int{
    "J-4-14-I":  5,  // Pneumonia ringan
    "J-4-14-II": 7,  // Pneumonia sedang
    "G-4-14-I":  3,  // GE ringan
    // ... more standards
}

func checkLOS(cbgCode string, actualLOS int) *string {
    standard, ok := standardLOS[cbgCode]
    if !ok {
        return nil
    }
    
    if actualLOS > standard * 2 {
        warning := fmt.Sprintf("LOS (%d hari) melebihi 2x standar (%d hari)", actualLOS, standard)
        return &warning
    }
    
    return nil
}
```

---

### Kriteria 19: Special Case

**Deskripsi:**
Kasus khusus yang memerlukan data tambahan.

| Special Case | Kode | Data Tambahan |
|--------------|------|---------------|
| PICU | PICU | icu_los, special_icu |
| NICU | NICU | icu_los, birth_weight |
| Kemoterapi | KEMO | jumlah siklus |
| Radioterapi | RADIO | jumlah fraksi |
| Hemodialisis | HD | dialpirah |

---

### Kriteria 20: Data Suplesi Lengkap

**Deskripsi:**
Jika ada klaim suplesi, data harus lengkap.

```go
type Suplesi struct {
    JenisSuplesi  string  // PICU, NICU, KEMO, dll
    JumlahHari    int
    TarifSuplesi  float64
    Keterangan    string
}
```

---

### Kriteria 21: Tidak Ada Duplikasi

**Deskripsi:**
Tidak boleh ada klaim duplikat untuk SEP yang sama.

**Validasi:**
```go
func checkDuplicate(sep string) error {
    var count int64
    db.Model(&EklaimClaim{}).
        Where("nomor_sep = ? AND deleted_at IS NULL", sep).
        Count(&count)
    
    if count > 0 {
        return fmt.Errorf("Klaim dengan SEP %s sudah ada", sep)
    }
    return nil
}
```

---

### Kriteria 22: Koneksi Rujukan Valid

**Deskripsi:**
Jika pasien rujukan, data rujukan harus valid.

---

### Kriteria 23: Terapi Konvalesen

**Deskripsi:**
Jika menggunakan terapi plasma konvalesen.

**Field:**
```go
TerapiKonvalesen string // "0" atau "1"
```

---

### Kriteria 24: PAPI (Patogen Spesifik)

**Deskripsi:**
Pemberian antipatogen spesifik.

**Field:**
```go
PAPIName  string  // Nama obat
PAPIValue float64 // Nilai/biaya
```

---

### Kriteria 25: Kelengkapan Data

**Deskripsi:**
Semua field wajib harus terisi.

**Field Wajib:**

| Field | Rawat Jalan | Rawat Inap |
|-------|-------------|------------|
| nomor_sep | ✓ | ✓ |
| nomor_kartu | ✓ | ✓ |
| tgl_masuk | ✓ | ✓ |
| tgl_pulang | ✓ | ✓ |
| cara_masuk | ✓ | ✓ |
| jenis_rawat | ✓ | ✓ |
| kelas_rawat | ✓ | ✓ |
| discharge_status | ✓ | ✓ |
| diagnosa | ✓ | ✓ |
| tarif_rs | ✓ | ✓ |
| coder_nik | ✓ | ✓ |
| icu_indikator | - | ✓ |
| birth_weight | Jika neonatus | Jika neonatus |

---

## Implementasi Validasi Lengkap

### Fungsi Validasi Utama

```go
type ClaimValidationResult struct {
    IsValid   bool
    Errors    []ValidationError
    Warnings  []ValidationWarning
}

type ValidationError struct {
    Field   string
    Code    string
    Message string
}

type ValidationWarning struct {
    Field   string
    Message string
}

func ValidateClaimData(claim *EklaimClaimRequest) *ClaimValidationResult {
    result := &ClaimValidationResult{IsValid: true}
    
    // Kriteria 1: SEP
    if err := validateSEP(claim.NomorSEP); err != nil {
        result.Errors = append(result.Errors, ValidationError{
            Field: "nomor_sep", Code: "K01", Message: err.Error(),
        })
    }
    
    // Kriteria 2: Tanggal
    if errs := validateDates(claim.TglMasuk, claim.TglPulang, claim.JenisRawat); len(errs) > 0 {
        for _, err := range errs {
            result.Errors = append(result.Errors, ValidationError{
                Field: "tanggal", Code: "K02", Message: err.Error(),
            })
        }
    }
    
    // Kriteria 3: Diagnosis Utama
    diagnoses := strings.Split(claim.Diagnosa, ",")
    if len(diagnoses) > 0 {
        if errs := validatePrimaryDiagnosis(diagnoses[0]); len(errs) > 0 {
            for _, err := range errs {
                result.Errors = append(result.Errors, ValidationError{
                    Field: "diagnosa", Code: "K03", Message: err.Error(),
                })
            }
        }
    }
    
    // Kriteria 4: Diagnosis Sekunder
    if len(diagnoses) > 1 {
        if errs := validateSecondaryDiagnoses(diagnoses[0], diagnoses[1:]); len(errs) > 0 {
            for _, err := range errs {
                result.Errors = append(result.Errors, ValidationError{
                    Field: "diagnosa_sekunder", Code: "K04", Message: err.Error(),
                })
            }
        }
    }
    
    // Kriteria 5: Prosedur
    if claim.Procedure != "" {
        procedures := strings.Split(claim.Procedure, ",")
        if errs := validateProcedures(procedures); len(errs) > 0 {
            for _, err := range errs {
                result.Errors = append(result.Errors, ValidationError{
                    Field: "procedure", Code: "K05", Message: err.Error(),
                })
            }
        }
    }
    
    // Kriteria 9: Tarif
    if err := validateTarifRS(claim.TarifRS); err != nil {
        result.Errors = append(result.Errors, ValidationError{
            Field: "tarif_rs", Code: "K09", Message: err.Error(),
        })
    }
    
    // Kriteria 10: Berat Lahir
    if err := validateBirthWeight(claim.BirthWeight, diagnoses); err != nil {
        result.Errors = append(result.Errors, ValidationError{
            Field: "birth_weight", Code: "K10", Message: err.Error(),
        })
    }
    
    // Kriteria 15: NIK Coder
    if err := validateCoderNIK(claim.CoderNIK); err != nil {
        result.Errors = append(result.Errors, ValidationError{
            Field: "coder_nik", Code: "K15", Message: err.Error(),
        })
    }
    
    // Kriteria 16: Konsistensi (Warning)
    if warnings := validateConsistency(diagnoses, strings.Split(claim.Procedure, ",")); len(warnings) > 0 {
        for _, w := range warnings {
            result.Warnings = append(result.Warnings, ValidationWarning{
                Field: "consistency", Message: w,
            })
        }
    }
    
    // Set IsValid
    result.IsValid = len(result.Errors) == 0
    
    return result
}
```

### UI Response untuk Validasi

```json
{
  "is_valid": false,
  "errors": [
    {
      "field": "diagnosa",
      "code": "K03",
      "message": "Kode Z tidak boleh sebagai diagnosis utama"
    },
    {
      "field": "coder_nik",
      "code": "K15",
      "message": "NIK Coder harus 16 digit"
    }
  ],
  "warnings": [
    {
      "field": "consistency",
      "message": "Diagnosis K35.8 biasanya memerlukan prosedur appendectomy"
    }
  ]
}
```

---

## Checklist Validasi per Kriteria

| No | Kriteria | Validasi | Level |
|----|----------|----------|-------|
| 1 | SEP Valid | Format & existence | Error |
| 2 | Tanggal Valid | Logic & format | Error |
| 3 | Diagnosis Utama | ICD-10 valid | Error |
| 4 | Diagnosis Sekunder | Max 10, no duplicate | Warning |
| 5 | Prosedur | ICD-9-CM valid | Error |
| 6 | Kelas Rawat | Sesuai hak | Error |
| 7 | Cara Masuk | Code valid | Error |
| 8 | Discharge Status | Code valid | Error |
| 9 | Tarif RS | > 0 | Error |
| 10 | Berat Lahir | Wajib jika neonatus | Error |
| 11 | ICU Indicator | Consistent | Warning |
| 12 | Ventilator Hours | If ventilator=1 | Warning |
| 13 | Upgrade Class | Consistent | Warning |
| 14 | ADL Score | If subacute/chronic | Warning |
| 15 | NIK Coder | 16 digit | Error |
| 16 | Konsistensi Dx-Proc | Logical | Warning |
| 17 | Severity Level | Auto | Info |
| 18 | LOS Sesuai | Within range | Warning |
| 19 | Special Case | Data lengkap | Error |
| 20 | Suplesi | Data lengkap | Error |
| 21 | No Duplicate | Unique SEP | Error |
| 22 | Rujukan | If rujukan | Error |
| 23 | Terapi Konvalesen | Optional | Info |
| 24 | PAPI | Optional | Info |
| 25 | Kelengkapan | All required | Error |

---

## Referensi

- DO 25 Kriteria Pengembangan Sistem IT Uji Coba iDRG.xlsx
- Manual Web Service E-Klaim 5.10.x.pdf
- ICD-10 WHO 2019
- ICD-9-CM 2007
