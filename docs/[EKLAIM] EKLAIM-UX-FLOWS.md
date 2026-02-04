# Alur UX E-Klaim - JSON Request/Response Detail

Dokumen ini berisi detail alur UX untuk implementasi E-Klaim di SIMRS sesuai dengan **25 Kriteria Pengembangan Sistem IT Uji Coba iDRG dari KEMENKES**.

---

## ⚠️ PENTING: Alur iDRG vs INACBG

**Alur BARU (iDRG):**
```
Input Data → Grouping iDRG → Final iDRG → Grouping INACBG → Final INACBG → Final Klaim → Kirim Klaim
```

**Perbedaan dengan Alur Lama:**
- iDRG grouping dilakukan **PERTAMA** sebelum INACBG
- Ada 2 tahap finalisasi: Final iDRG dan Final INACBG
- Tombol muncul secara **kondisional** berdasarkan status
- Wajib menggunakan **ICD-10 2010 IM** dan **ICD-9-CM 2010 IM**

---

## Daftar Isi

1. [25 Kriteria KEMENKES](#25-kriteria-kemenkes-idrg)
2. [Alur Utama iDRG](#alur-utama-idrg)
3. [State & Tombol Kondisional](#state--tombol-kondisional)
4. [Referensi Kode Select/Dropdown](#referensi-kode-selectdropdown)
5. [Alur Rawat Inap](#alur-1-rawat-inap-standar)
6. [Alur Rawat Jalan](#alur-2-rawat-jalan)
7. [Alur IGD](#alur-3-igd)
8. [Alur Re-Grouping](#alur-4-re-grouping-koreksi)
9. [Alur Dispute/Reedit](#alur-5-disputereedit-klaim)
10. [Alur Khusus ICU](#alur-6-khusus-icu)
11. [Alur Khusus Neonatus](#alur-7-khusus-neonatus)

---

## 25 Kriteria KEMENKES (iDRG)

### Persiapan & Data Master

| No | Kriteria | Deskripsi | Status |
|----|----------|-----------|--------|
| 1 | Setup Development Environment | Development WAJIB di server terpisah, TIDAK BOLEH di production | ⬜ |
| 2 | Implement ICD-10 2010 IM | Gunakan ICD-10 versi 2010 Indonesian Modification | ⬜ |
| 3 | Implement ICD-9-CM 2010 IM | Gunakan ICD-9-CM versi 2010 Indonesian Modification | ⬜ |
| 4 | Multiplicity & Setting Procedure | Input procedure WAJIB ada multiplicity dan setting | ⬜ |

### Alur Grouping iDRG

| No | Kriteria | Deskripsi | Status |
|----|----------|-----------|--------|
| 5 | Grouping iDRG Dilakukan PERTAMA | Setelah input, grouping iDRG dilakukan SEBELUM INACBG | ⬜ |
| 6 | Grouping iDRG | Aksi grouping untuk mendapatkan kode iDRG | ⬜ |
| 7 | Tombol Final iDRG Muncul | HANYA muncul jika grouping iDRG valid (bukan error) | ⬜ |
| 8 | Tombol Final iDRG Hidden jika Error | Jika ungroupable, tombol final TIDAK BOLEH muncul/disabled | ⬜ |
| 9 | Final Grouping iDRG | Aksi finalisasi coding/grouping iDRG | ⬜ |
| 10 | Form Disabled setelah iDRG Final | Seluruh form input WAJIB read-only setelah iDRG final | ⬜ |
| 11 | Tombol Edit Ulang iDRG | Muncul setelah iDRG final, menggantikan tombol Final | ⬜ |

### Alur Grouping INACBG

| No | Kriteria | Deskripsi | Status |
|----|----------|-----------|--------|
| 12 | INACBG Coding Muncul setelah iDRG Final | Input INACBG HANYA boleh muncul setelah iDRG final | ⬜ |
| 13 | Import Coding iDRG ke INACBG | Ada tombol import coding dari iDRG ke INACBG | ⬜ |
| 14 | Warning IM pada INACBG | Tampilkan warning untuk kode yang tidak valid di INACBG | ⬜ |
| 15 | Grouping INACBG | Aksi grouping untuk mendapatkan kode INACBG | ⬜ |
| 16 | Tombol Final INACBG Muncul | HANYA muncul jika grouping INACBG valid | ⬜ |
| 17 | Tombol Final INACBG Hidden jika Error | Jika ungroupable, tombol final TIDAK BOLEH muncul | ⬜ |
| 18 | Final Grouping INACBG | Aksi finalisasi coding/grouping INACBG | ⬜ |
| 19 | Tombol Edit Ulang INACBG | Muncul setelah INACBG final | ⬜ |

### Alur Finalisasi & Kirim Klaim

| No | Kriteria | Deskripsi | Status |
|----|----------|-----------|--------|
| 20 | Tombol Final Klaim Muncul | HANYA muncul setelah INACBG final | ⬜ |
| 21 | Final Klaim | Aksi finalisasi Klaim | ⬜ |
| 22 | Tombol Kirim Klaim | HANYA muncul setelah Klaim final | ⬜ |
| 23 | Tombol Cetak Klaim | HANYA muncul setelah Klaim final | ⬜ |
| 24 | Tombol Edit Ulang Hilang | Edit Ulang iDRG & INACBG TIDAK BOLEH muncul setelah Klaim final | ⬜ |
| 25 | Sinkronisasi Data | Data SIMRS WAJIB sinkron dengan data E-Klaim | ⬜ |

---

## Alur Utama iDRG

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            ALUR E-KLAIM iDRG (KEMENKES)                         │
└─────────────────────────────────────────────────────────────────────────────────┘

[1. INPUT DATA KLAIM]
     │ • Data pasien, SEP, tanggal masuk/pulang
     │ • Diagnosis (ICD-10 2010 IM)
     │ • Procedure (ICD-9-CM 2010 IM) + multiplicity + setting
     │ • Tarif RS
     │
     │ Tombol: [Simpan Draft] [Grouping iDRG]
     ▼
[2. GROUPING iDRG] ◄──────────────────────────────────────┐
     │ API: grouper_idrg                                  │
     │                                                    │
     ├─── ❌ Error/Ungroupable ───► Form tetap editable   │
     │        Tombol Final: HIDDEN/DISABLED              │
     │        [Edit] [Grouping iDRG]                      │
     │                                                    │
     └─── ✅ Valid ───► Tampilkan hasil iDRG              │
              Tombol: [Final iDRG]                        │
              ▼                                           │
[3. FINAL iDRG]                                           │
     │ API: final_idrg                                    │
     │ • Form input DISABLED (read-only)                  │
     │ • Section INACBG muncul                            │
     │                                                    │
     │ Tombol: [Edit Ulang iDRG] ─────────────────────────┘
     ▼
[4. IMPORT KE INACBG]
     │ • Tombol: [Import dari iDRG]
     │ • Copy semua coding dari iDRG ke INACBG
     │ • Tampilkan WARNING jika ada kode IM yang tidak valid
     ▼
[5. GROUPING INACBG] ◄────────────────────────────────────┐
     │ API: grouper (INACBG standar)                      │
     │                                                    │
     ├─── ❌ Error/Ungroupable ───► Edit coding INACBG    │
     │        Tombol Final: HIDDEN/DISABLED              │
     │        [Edit] [Grouping INACBG]                    │
     │                                                    │
     └─── ✅ Valid ───► Tampilkan hasil INACBG            │
              Tombol: [Final INACBG]                      │
              ▼                                           │
[6. FINAL INACBG]                                         │
     │ API: final_inacbg                                  │
     │ • Coding INACBG DISABLED                           │
     │                                                    │
     │ Tombol: [Edit Ulang iDRG] [Edit Ulang INACBG] ─────┘
     │         [Final Klaim]
     ▼
[7. FINAL KLAIM]
     │ API: claim_final
     │ • Tombol Edit Ulang: HIDDEN
     │
     │ Tombol: [Kirim Klaim] [Cetak Klaim]
     ▼
[8. KIRIM KLAIM]
     │ API: send_claim
     │ Status: TERKIRIM → Tunggu verifikasi BPJS
     ▼
[9. MONITORING]
     │ • Status: LAYAK / TIDAK_LAYAK / DISPUTE
     │ • Jika TIDAK_LAYAK → bisa Reedit
     └────────────────────────────────────────────────────
```

---

## State & Tombol Kondisional

### State Machine

```
DRAFT → IDRG_GROUPED → IDRG_FINAL → INACBG_GROUPED → INACBG_FINAL → CLAIM_FINAL → SENT → VERIFIED
```

### Visibility Tombol per State

| State | Form Input | Grouping iDRG | Final iDRG | Edit iDRG | Section INACBG | Grouping INACBG | Final INACBG | Edit INACBG | Final Klaim | Kirim | Cetak |
|-------|------------|---------------|------------|-----------|----------------|-----------------|--------------|-------------|-------------|-------|-------|
| DRAFT | ✅ Enabled | ✅ Show | ❌ Hide | ❌ Hide | ❌ Hide | ❌ Hide | ❌ Hide | ❌ Hide | ❌ Hide | ❌ Hide | ❌ Hide |
| IDRG_GROUPED (Valid) | ✅ Enabled | ✅ Show | ✅ Show | ❌ Hide | ❌ Hide | ❌ Hide | ❌ Hide | ❌ Hide | ❌ Hide | ❌ Hide | ❌ Hide |
| IDRG_GROUPED (Error) | ✅ Enabled | ✅ Show | ❌ Hide | ❌ Hide | ❌ Hide | ❌ Hide | ❌ Hide | ❌ Hide | ❌ Hide | ❌ Hide | ❌ Hide |
| IDRG_FINAL | 🔒 Disabled | ❌ Hide | ❌ Hide | ✅ Show | ✅ Show | ✅ Show | ❌ Hide | ❌ Hide | ❌ Hide | ❌ Hide | ❌ Hide |
| INACBG_GROUPED (Valid) | 🔒 Disabled | ❌ Hide | ❌ Hide | ✅ Show | ✅ Show | ✅ Show | ✅ Show | ❌ Hide | ❌ Hide | ❌ Hide | ❌ Hide |
| INACBG_GROUPED (Error) | 🔒 Disabled | ❌ Hide | ❌ Hide | ✅ Show | ✅ Show | ✅ Show | ❌ Hide | ❌ Hide | ❌ Hide | ❌ Hide | ❌ Hide |
| INACBG_FINAL | 🔒 Disabled | ❌ Hide | ❌ Hide | ✅ Show | 🔒 Disabled | ❌ Hide | ❌ Hide | ✅ Show | ✅ Show | ❌ Hide | ❌ Hide |
| CLAIM_FINAL | 🔒 Disabled | ❌ Hide | ❌ Hide | ❌ Hide | 🔒 Disabled | ❌ Hide | ❌ Hide | ❌ Hide | ❌ Hide | ✅ Show | ✅ Show |
| SENT | 🔒 Disabled | ❌ Hide | ❌ Hide | ❌ Hide | 🔒 Disabled | ❌ Hide | ❌ Hide | ❌ Hide | ❌ Hide | ❌ Hide | ✅ Show |

### Implementasi Frontend (React)

```tsx
// State untuk Claim
type ClaimState = 
  | 'DRAFT' 
  | 'IDRG_GROUPED' 
  | 'IDRG_FINAL' 
  | 'INACBG_GROUPED' 
  | 'INACBG_FINAL' 
  | 'CLAIM_FINAL' 
  | 'SENT' 
  | 'VERIFIED';

interface ClaimData {
  state: ClaimState;
  idrgValid: boolean;    // true jika grouping iDRG berhasil
  inacbgValid: boolean;  // true jika grouping INACBG berhasil
  // ... data lainnya
}

// Logic untuk visibility tombol
const ButtonVisibility = {
  showGroupingIDRG: (state: ClaimState) => 
    ['DRAFT', 'IDRG_GROUPED'].includes(state),
  
  showFinalIDRG: (state: ClaimState, idrgValid: boolean) => 
    state === 'IDRG_GROUPED' && idrgValid,
  
  showEditIDRG: (state: ClaimState) => 
    ['IDRG_FINAL', 'INACBG_GROUPED', 'INACBG_FINAL'].includes(state),
  
  showSectionINACBG: (state: ClaimState) => 
    ['IDRG_FINAL', 'INACBG_GROUPED', 'INACBG_FINAL', 'CLAIM_FINAL', 'SENT'].includes(state),
  
  showGroupingINACBG: (state: ClaimState) => 
    ['IDRG_FINAL', 'INACBG_GROUPED'].includes(state),
  
  showFinalINACBG: (state: ClaimState, inacbgValid: boolean) => 
    state === 'INACBG_GROUPED' && inacbgValid,
  
  showEditINACBG: (state: ClaimState) => 
    state === 'INACBG_FINAL',
  
  showFinalKlaim: (state: ClaimState) => 
    state === 'INACBG_FINAL',
  
  showKirimKlaim: (state: ClaimState) => 
    state === 'CLAIM_FINAL',
  
  showCetakKlaim: (state: ClaimState) => 
    ['CLAIM_FINAL', 'SENT', 'VERIFIED'].includes(state),
  
  isFormDisabled: (state: ClaimState) => 
    !['DRAFT', 'IDRG_GROUPED'].includes(state),
};
```

---

## Input Procedure dengan Multiplicity & Setting

Sesuai kriteria #4, input procedure WAJIB memiliki multiplicity dan setting:

```tsx
interface ProcedureInput {
  code: string;          // Kode ICD-9-CM 2010 IM
  name: string;          // Nama prosedur
  multiplicity: number;  // Jumlah pengulangan (1-99)
  setting: ProcedureSetting;
}

type ProcedureSetting = 
  | 'OR'      // Operating Room (Kamar Operasi)
  | 'NON_OR'  // Non-Operating Room
  | 'ICU'     // Intensive Care Unit
  | 'CATH'    // Catheterization Lab
  | 'ENDO'    // Endoscopy
  | 'OTHER';  // Lainnya

// Contoh UI
<ProcedureInput
  code="47.09"
  name="Other appendectomy"
  multiplicity={1}
  setting="OR"
  onMultiplicityChange={(val) => setMultiplicity(val)}
  onSettingChange={(val) => setSetting(val)}
/>
```

### JSON dengan Multiplicity & Setting

```json
{
  "procedures": [
    {
      "code": "47.09",
      "multiplicity": 1,
      "setting": "OR"
    },
    {
      "code": "93.94",
      "multiplicity": 3,
      "setting": "NON_OR"
    }
  ]
}
```

---

## Warning IM pada INACBG

Sesuai kriteria #14, ketika import dari iDRG ke INACBG, tampilkan warning untuk kode yang tidak valid:

```tsx
interface ImportWarning {
  code: string;
  type: 'diagnosis' | 'procedure';
  message: string;
  suggestion?: string;
}

// Contoh warning
const warnings: ImportWarning[] = [
  {
    code: "A09.0",
    type: "diagnosis",
    message: "Kode A09.0 adalah kode IM, tidak berlaku di INACBG standar",
    suggestion: "Gunakan kode A09 (tanpa .0)"
  },
  {
    code: "99.29",
    type: "procedure", 
    message: "Kode 99.29 tidak valid di ICD-9-CM standar INACBG",
    suggestion: "Gunakan kode 99.2"
  }
];

// UI Warning
<Alert variant="warning">
  <AlertTitle>⚠️ Kode IM Tidak Berlaku di INACBG</AlertTitle>
  <AlertDescription>
    Beberapa kode dari iDRG tidak valid di INACBG. 
    Silakan sesuaikan sebelum melakukan grouping INACBG.
  </AlertDescription>
  <ul>
    {warnings.map(w => (
      <li key={w.code}>
        <strong>{w.code}</strong>: {w.message}
        {w.suggestion && <span> → {w.suggestion}</span>}
      </li>
    ))}
  </ul>
</Alert>
```

---

## Referensi Kode Select/Dropdown

### 1. cara_masuk - Cara Masuk Pasien

| Value | Deskripsi | Kapan Digunakan |
|-------|-----------|-----------------|
| `"1"` | **IGD (Instalasi Gawat Darurat)** | Pasien masuk melalui IGD/UGD |
| `"2"` | **Poliklinik/Rawat Jalan** | Pasien masuk melalui pendaftaran poli |
| `"3"` | **Rujukan Langsung dari RS Lain** | Pasien dirujuk dari RS lain langsung ke rawat inap |
| `"4"` | **Lahir di Rumah Sakit** | Bayi baru lahir di RS ini (neonatus) |

### 2. jenis_rawat - Jenis Pelayanan

| Value | Deskripsi | LOS | Contoh |
|-------|-----------|-----|--------|
| `"1"` | **Rawat Inap** | ≥ 1 hari | Pasien menginap di RS |
| `"2"` | **Rawat Jalan** | 0 hari (same day) | Pasien pulang di hari yang sama |

### 3. kelas_rawat - Kelas Perawatan

| Value | Deskripsi | Hak Peserta | Catatan |
|-------|-----------|-------------|---------|
| `"1"` | **Kelas 1** | PBI/Jamkesmas upgrade, Mandiri Kelas 1 | Ruang 2 bed |
| `"2"` | **Kelas 2** | Mandiri Kelas 2 | Ruang 4 bed |
| `"3"` | **Kelas 3** | PBI/Jamkesmas, Mandiri Kelas 3 | Ruang >4 bed |

### 4. discharge_status - Status Pulang

| Value | Deskripsi | Dokumentasi Tambahan |
|-------|-----------|---------------------|
| `"1"` | **Atas Persetujuan Dokter** | Resume medis lengkap |
| `"2"` | **Pulang Paksa** | Surat pernyataan pulang paksa |
| `"3"` | **Atas Permintaan Sendiri (APS)** | Surat pernyataan APS |
| `"4"` | **Meninggal** | Surat keterangan kematian |
| `"5"` | **Rujuk Keluar** | Surat rujukan ke RS lain |

### 5. icu_indikator - Indikator Perawatan ICU

| Value | Deskripsi |
|-------|-----------|
| `"0"` | **Tidak ada perawatan ICU** |
| `"1"` | **Ada perawatan ICU** (wajib isi `icu_los` dan `special_icu`) |

### 6. ventilator - Penggunaan Ventilator

| Value | Deskripsi |
|-------|-----------|
| `"0"` | **Tidak menggunakan ventilator** |
| `"1"` | **Menggunakan ventilator** (wajib isi `ventilator_hour`) |

### 7. upgrade_class_ind - Indikator Naik Kelas

| Value | Deskripsi |
|-------|-----------|
| `"0"` | **Tidak naik kelas** |
| `"1"` | **Naik kelas** (wajib isi `upgrade_class_class` dan `upgrade_class_los`) |

### 8. upgrade_class_class - Kelas yang Dinaiki

| Value | Deskripsi | Dari Kelas |
|-------|-----------|------------|
| `"1"` | **Naik ke Kelas 1** | Dari Kelas 2 atau 3 |
| `"2"` | **Naik ke Kelas 2** | Dari Kelas 3 |
| `"vip"` | **Naik ke VIP** | Dari Kelas 1/2/3 |

### 9. adl_sub_acute - ADL Score Subacute

| Value | Deskripsi |
|-------|-----------|
| `"0"` | **Tidak ada / Tidak termasuk subacute** |
| `"1-100"` | **Skor ADL** (Activities of Daily Living) |

### 10. adl_chronic - ADL Score Chronic

| Value | Deskripsi |
|-------|-----------|
| `"0"` | **Tidak ada / Tidak termasuk chronic** |
| `"1-100"` | **Skor ADL** (Activities of Daily Living) |

### 11. subacute - Status Subacute Care

| Value | Deskripsi |
|-------|-----------|
| `"0"` | **Bukan subacute care** |
| `"1"` | **Subacute care** (wajib isi `subacute_los`) |

### 12. chronic - Status Chronic Care

| Value | Deskripsi |
|-------|-----------|
| `"0"` | **Bukan chronic care** |
| `"1"` | **Chronic care** (wajib isi `chronic_los`) |

### 13. dialpirah - Hemodialisis (Cuci Darah)

| Value | Deskripsi |
|-------|-----------|
| `"0"` | **Tidak ada hemodialisis** |
| `"1-99"` | **Jumlah sesi hemodialisis** selama rawat |

### 14. terapi_konvalesen - Terapi Plasma Konvalesen

| Value | Deskripsi |
|-------|-----------|
| `"0"` | **Tidak menggunakan plasma konvalesen** |
| `"1"` | **Menggunakan terapi plasma konvalesen** (untuk COVID-19) |

### 15. special_icu - Tipe ICU Khusus

| Value | Deskripsi | Tarif Top-Up |
|-------|-----------|--------------|
| `""` | **Tidak ada** | - |
| `"IC"` | **ICU (Intensive Care Unit)** | Ya |
| `"ICCU"` | **ICCU (Intensive Cardiac Care Unit)** | Ya |
| `"PICU"` | **PICU (Pediatric ICU)** | Ya |
| `"NICU"` | **NICU (Neonatal ICU)** | Ya |
| `"BURN"` | **Burn Unit** | Ya |
| `"ECMO"` | **ECMO Support** | Ya |

### 16. ICU LOS Detail (icu_los_*)

| Field | Deskripsi |
|-------|-----------|
| `icu_los` | **Total hari ICU** |
| `icu_los_ec` | **Hari di ICU biasa** |
| `icu_los_eo` | **Hari dengan Observasi khusus** |
| `icu_los_etl` | **Hari dengan Transplantasi** |
| `icu_los_em` | **Hari dengan Monitoring intensif** |
| `icu_los_ecmo` | **Hari dengan ECMO** |

### 17. add_payment_pct - Persentase Pembayaran Tambahan

| Value | Deskripsi |
|-------|-----------|
| `"0"` | **Tidak ada pembayaran tambahan** |
| `"1-100"` | **Persentase tambahan** (untuk kasus tertentu) |

### 18. Status Klaim

| Status | Deskripsi | Aksi Selanjutnya |
|--------|-----------|------------------|
| `CREATED` | Klaim baru dibuat | Lakukan Grouping |
| `UPDATED` | Klaim diupdate | Lakukan Re-Grouping |
| `GROUPED` | Sudah di-grouping | Finalisasi atau Edit |
| `FINALIZED` | Sudah dikirim ke BPJS | Tunggu verifikasi |
| `CANCELLED` | Finalisasi dibatalkan | Edit dan kirim ulang |
| `REEDITED` | Sudah di-reedit | Grouping ulang |
| `PENDING` | Menunggu verifikasi BPJS | Monitoring |
| `LAYAK` | Disetujui verifikator | Selesai |
| `TIDAK_LAYAK` | Ditolak verifikator | Reedit atau dispute |
| `DISPUTE` | Dalam proses sengketa | Tunggu keputusan |
| `DELETED` | Klaim dihapus | - |

### 19. Severity Level (Otomatis dari Grouper)

| Level | Deskripsi | Tarif |
|-------|-----------|-------|
| `0` | **Rawat Jalan** | Tarif paket |
| `I` | **Ringan (Mild)** | Tarif dasar |
| `II` | **Sedang (Moderate)** | Tarif + 20-40% |
| `III` | **Berat (Severe)** | Tarif + 50-100% |

### 20. Birth Weight Categories (untuk Neonatus)

| Berat (gram) | Kategori | Kode CBG |
|--------------|----------|----------|
| < 750 | BBLSAR (Sangat Amat Rendah) | P-x-xx-III |
| 750 - 999 | BBLSR (Sangat Rendah) | P-x-xx-III |
| 1000 - 1499 | BBLR Berat | P-x-xx-II |
| 1500 - 1999 | BBLR Sedang | P-x-xx-II |
| 2000 - 2499 | BBLR Ringan | P-x-xx-I |
| 2500 - 4000 | Normal | P-x-xx-0 |
| > 4000 | Makrosomia | P-x-xx-I |

---

## Alur 1: Rawat Inap Standar

### Skenario
Pasien BPJS rawat inap dengan diagnosis Pneumonia, dirawat 4 hari.

### Step 1: Input Data Klaim (State: DRAFT)

**UI Form - Semua field ENABLED:**
- Nomor SEP (input manual jika belum ada VClaim)
- Nomor Kartu BPJS
- Tanggal Masuk/Pulang (auto dari visit)
- Diagnosis dengan **ICD-10 2010 IM** (auto dari rekam medis)
- Prosedur dengan **ICD-9-CM 2010 IM** + **Multiplicity** + **Setting** (auto dari tindakan)
- Tarif RS (auto dari billing)

**Tombol Tersedia:** `[Simpan Draft]` `[Grouping iDRG]`

**Request - Simpan Draft:**
```json
{
  "metadata": {
    "method": "save_draft"
  },
  "data": {
    "nomor_sep": "0301R0010124010001",
    "nomor_kartu": "0001234567890",
    "tgl_masuk": "2024-01-15",
    "tgl_pulang": "2024-01-18",
    "cara_masuk": "2",
    "jenis_rawat": "1",
    "kelas_rawat": "3",
    "adl_sub_acute": "0",
    "adl_chronic": "0",
    "icu_indikator": "0",
    "icu_los": "0",
    "ventilator_hour": "0",
    "ventilator": "0",
    "dialpirah": "0",
    "upgrade_class_ind": "0",
    "upgrade_class_class": "",
    "upgrade_class_los": "0",
    "add_payment_pct": "0",
    "birth_weight": "0",
    "discharge_status": "1",
    "diagnosa": [
      {"code": "J18.9", "type": "UTAMA"}
    ],
    "procedure": [
      {"code": "93.94", "multiplicity": 3, "setting": "NON_OR"}
    ],
    "tarif_rs": 5500000.00,
    "coder_nik": "3374011234567890"
  }
}
```

### Step 2: Grouping iDRG (State: IDRG_GROUPED)

**Tombol:** `[Grouping iDRG]`

**Request:**
```json
{
  "metadata": {
    "method": "grouper_idrg"
  },
  "data": {
    "nomor_sep": "0301R0010124010001"
  }
}
```

**Response Success (Valid) → Tombol Final iDRG MUNCUL:**
```json
{
  "metadata": {
    "code": "200",
    "message": "Grouping iDRG berhasil"
  },
  "response": {
    "sep": "0301R0010124010001",
    "idrg": {
      "code": "J-4-14-01",
      "description": "Pneumonia, tanpa komplikasi",
      "tariff": 4850000.00,
      "severity_level": "1",
      "grouper_version": "iDRG-1.0"
    },
    "status": "VALID",
    "diagnoses_processed": [
      {"code": "J18.9", "name": "Pneumonia, unspecified organism", "type": "UTAMA", "valid": true}
    ],
    "procedures_processed": [
      {"code": "93.94", "name": "Respiratory medication by nebulizer", "multiplicity": 3, "setting": "NON_OR", "valid": true}
    ]
  }
}
```

**Response Error (Ungroupable) → Tombol Final iDRG HIDDEN:**
```json
{
  "metadata": {
    "code": "301",
    "message": "Grouping iDRG gagal - Ungroupable"
  },
  "response": {
    "sep": "0301R0010124010001",
    "status": "UNGROUPABLE",
    "errors": [
      {
        "field": "diagnosa",
        "code": "Z00.0",
        "message": "Kode Z tidak boleh sebagai diagnosis utama untuk iDRG"
      }
    ]
  }
}
```

**UI setelah Grouping Valid:**
```
┌────────────────────────────────────────────────┐
│ HASIL GROUPING iDRG ✅                          │
├────────────────────────────────────────────────┤
│ Kode iDRG    : J-4-14-01                       │
│ Deskripsi    : Pneumonia, tanpa komplikasi     │
│ Severity     : Level 1                         │
│ Tarif iDRG   : Rp  4.850.000                   │
├────────────────────────────────────────────────┤
│ [Edit Data]  [Grouping Ulang]  [✓ Final iDRG]  │
└────────────────────────────────────────────────┘
```

**UI setelah Grouping Error:**
```
┌────────────────────────────────────────────────┐
│ HASIL GROUPING iDRG ❌                          │
├────────────────────────────────────────────────┤
│ Status: UNGROUPABLE                            │
│ Error: Kode Z tidak boleh sebagai diagnosis    │
│        utama untuk iDRG                        │
├────────────────────────────────────────────────┤
│ [Edit Data]  [Grouping Ulang]                  │
│ ⚠️ Tombol Final iDRG tidak tersedia            │
└────────────────────────────────────────────────┘
```

### Step 3: Final iDRG (State: IDRG_FINAL)

**Tombol:** `[Final iDRG]` (hanya muncul jika grouping valid)

**Request:**
```json
{
  "metadata": {
    "method": "final_idrg"
  },
  "data": {
    "nomor_sep": "0301R0010124010001",
    "coder_nik": "3374011234567890"
  }
}
```

**Response:**
```json
{
  "metadata": {
    "code": "200",
    "message": "iDRG berhasil difinalisasi"
  },
  "response": {
    "sep": "0301R0010124010001",
    "status": "IDRG_FINAL",
    "idrg_code": "J-4-14-01",
    "finalized_at": "2024-01-18T14:00:00Z"
  }
}
```

**Setelah Final iDRG:**
- ✅ Form input data klaim menjadi **DISABLED/READ-ONLY**
- ✅ Section INACBG **MUNCUL**
- ✅ Tombol `[Edit Ulang iDRG]` muncul
- ❌ Tombol `[Final iDRG]` hilang

### Step 4: Import ke INACBG & Cek Warning IM

**Tombol:** `[Import dari iDRG]`

**Request:**
```json
{
  "metadata": {
    "method": "import_idrg_to_inacbg"
  },
  "data": {
    "nomor_sep": "0301R0010124010001"
  }
}
```

**Response dengan Warning IM:**
```json
{
  "metadata": {
    "code": "200",
    "message": "Import berhasil dengan warning"
  },
  "response": {
    "sep": "0301R0010124010001",
    "imported": {
      "diagnoses": [
        {"code": "J18.9", "valid_inacbg": true}
      ],
      "procedures": [
        {"code": "93.94", "valid_inacbg": true, "multiplicity": 3, "setting": "NON_OR"}
      ]
    },
    "warnings": [
      {
        "code": "A09.0",
        "type": "diagnosis",
        "message": "Kode A09.0 adalah kode IM, tidak berlaku di INACBG standar",
        "suggestion": "Gunakan kode A09"
      }
    ]
  }
}
```

**UI Warning:**
```
┌────────────────────────────────────────────────┐
│ ⚠️ PERINGATAN: KODE IM TIDAK BERLAKU           │
├────────────────────────────────────────────────┤
│ Beberapa kode dari iDRG tidak valid di INACBG: │
│                                                │
│ • A09.0 → Gunakan A09                          │
│                                                │
│ Silakan sesuaikan sebelum grouping INACBG.     │
├────────────────────────────────────────────────┤
│ [OK, Saya Mengerti]                            │
└────────────────────────────────────────────────┘
```

### Step 5: Grouping INACBG (State: INACBG_GROUPED)

**Tombol:** `[Grouping INACBG]`

**Request:**
```json
{
  "metadata": {
    "method": "grouper"
  },
  "data": {
    "nomor_sep": "0301R0010124010001"
  }
}
```

**Response:**
```json
{
  "metadata": {
    "code": "200",
    "message": "Grouping INACBG berhasil"
  },
  "response": {
    "sep": "0301R0010124010001",
    "cbg": {
      "code": "J-4-14-I",
      "description": "Pneumonia, Ringan",
      "tariff": 4850000.00,
      "tariff_base": 4500000.00,
      "top_up_tariff": 350000.00
    },
    "hospital_tariff": 5500000.00,
    "difference": -650000.00,
    "status": "VALID",
    "grouper_version": "5.10.0",
    "severity_level": "I"
  }
}
```

**UI Display:**
```
┌────────────────────────────────────────────────┐
│ HASIL GROUPING INACBG ✅                        │
├────────────────────────────────────────────────┤
│ Kode CBG     : J-4-14-I                        │
│ Deskripsi    : Pneumonia, Ringan               │
│ Severity     : Level I (Ringan)                │
├────────────────────────────────────────────────┤
│ Tarif RS     : Rp  5.500.000                   │
│ Tarif CBG    : Rp  4.850.000                   │
│ Selisih      : Rp   -650.000 (⚠️ Rugi)         │
├────────────────────────────────────────────────┤
│ [Edit Ulang iDRG] [Edit INACBG] [✓ Final INACBG]│
└────────────────────────────────────────────────┘
```

### Step 6: Final INACBG (State: INACBG_FINAL)

**Tombol:** `[Final INACBG]` (hanya muncul jika grouping valid)

**Request:**
```json
{
  "metadata": {
    "method": "final_inacbg"
  },
  "data": {
    "nomor_sep": "0301R0010124010001",
    "coder_nik": "3374011234567890"
  }
}
```

**Response:**
```json
{
  "metadata": {
    "code": "200",
    "message": "INACBG berhasil difinalisasi"
  },
  "response": {
    "sep": "0301R0010124010001",
    "status": "INACBG_FINAL",
    "cbg_code": "J-4-14-I",
    "cbg_tariff": 4850000.00,
    "finalized_at": "2024-01-18T14:30:00Z"
  }
}
```

**Setelah Final INACBG:**
- ✅ Section INACBG menjadi **DISABLED/READ-ONLY**
- ✅ Tombol `[Edit Ulang iDRG]` masih ada
- ✅ Tombol `[Edit Ulang INACBG]` muncul
- ✅ Tombol `[Final Klaim]` **MUNCUL**

### Step 7: Final Klaim (State: CLAIM_FINAL)

**Tombol:** `[Final Klaim]` (hanya muncul setelah INACBG final)

**Request:**
```json
{
  "metadata": {
    "method": "claim_final"
  },
  "data": {
    "nomor_sep": "0301R0010124010001",
    "coder_nik": "3374011234567890"
  }
}
```

**Response:**
```json
{
  "metadata": {
    "code": "200",
    "message": "Klaim berhasil difinalisasi"
  },
  "response": {
    "sep": "0301R0010124010001",
    "status": "CLAIM_FINAL",
    "idrg_code": "J-4-14-01",
    "cbg_code": "J-4-14-I",
    "cbg_tariff": 4850000.00,
    "finalized_at": "2024-01-18T15:00:00Z"
  }
}
```

**Setelah Final Klaim:**
- ❌ Tombol `[Edit Ulang iDRG]` **HILANG**
- ❌ Tombol `[Edit Ulang INACBG]` **HILANG**
- ✅ Tombol `[Kirim Klaim]` **MUNCUL**
- ✅ Tombol `[Cetak Klaim]` **MUNCUL**

### Step 8: Kirim Klaim (State: SENT)

**Tombol:** `[Kirim Klaim]`

**Request:**
```json
{
  "metadata": {
    "method": "send_claim"
  },
  "data": {
    "nomor_sep": "0301R0010124010001"
  }
}
```

**Response:**
```json
{
  "metadata": {
    "code": "200",
    "message": "Klaim berhasil dikirim"
  },
  "response": {
    "sep": "0301R0010124010001",
    "status": "SENT",
    "sent_at": "2024-01-18T15:30:00Z",
    "claim_number": "FPK-2024-01-00001"
  }
}
```

### Step 9: Update Billing dengan Hasil Klaim

**Simpan ke Billing (Sinkronisasi - Kriteria #25):**
```json
{
  "billing_id": 789,
  "idrg_code": "J-4-14-01",
  "idrg_tariff": 4850000.00,
  "inacbg_code": "J-4-14-I",
  "inacbg_description": "Pneumonia, Ringan",
  "inacbg_tariff": 4850000.00,
  "bpjs_claim_amount": 4850000.00,
  "claim_status": "SENT",
  "claim_sent_at": "2024-01-18T15:30:00Z"
}
```

---

## Alur 2: Rawat Jalan Standar

### Skenario
Pasien BPJS kontrol DM type 2 di poli penyakit dalam.

### State Flow (Sama dengan Rawat Inap)
```
DRAFT → IDRG_GROUPED → IDRG_FINAL → INACBG_GROUPED → INACBG_FINAL → CLAIM_FINAL → SENT
```

### Step 1: Input Data Klaim (State: DRAFT)

**Request:**
```json
{
  "metadata": {
    "method": "save_draft"
  },
  "data": {
    "nomor_sep": "0301R0010124020001",
    "nomor_kartu": "0001234567891",
    "tgl_masuk": "2024-01-20",
    "tgl_pulang": "2024-01-20",
    "cara_masuk": "2",
    "jenis_rawat": "2",
    "kelas_rawat": "3",
    "adl_sub_acute": "0",
    "adl_chronic": "0",
    "icu_indikator": "0",
    "icu_los": "0",
    "ventilator_hour": "0",
    "ventilator": "0",
    "dialpirah": "0",
    "upgrade_class_ind": "0",
    "upgrade_class_class": "",
    "upgrade_class_los": "0",
    "add_payment_pct": "0",
    "birth_weight": "0",
    "discharge_status": "1",
    "diagnosa": [
      {"code": "E11.9", "type": "UTAMA"}
    ],
    "procedure": [],
    "tarif_rs": 250000.00,
    "coder_nik": "3374011234567890"
  }
}
```

### Step 2: Grouping iDRG

**Request:**
```json
{
  "metadata": {
    "method": "grouper_idrg"
  },
  "data": {
    "nomor_sep": "0301R0010124020001"
  }
}
```

**Response:**
```json
{
  "metadata": {
    "code": "200",
    "message": "Grouping iDRG berhasil"
  },
  "response": {
    "sep": "0301R0010124020001",
    "idrg": {
      "code": "E-4-17-01",
      "description": "Diabetes tanpa komplikasi, rawat jalan",
      "tariff": 180000.00,
      "severity_level": "1"
    },
    "status": "VALID"
  }
}
```

### Step 3-8: (Ikuti Alur Rawat Inap)

Proses selanjutnya sama dengan Rawat Inap:
1. **Final iDRG** → Form disabled
2. **Import ke INACBG** → Cek warning IM (jika ada)
3. **Grouping INACBG**
4. **Final INACBG**
5. **Final Klaim**
6. **Kirim Klaim**

### Response Grouping INACBG (Rawat Jalan):
```json
{
  "metadata": {
    "code": "200",
    "message": "Grouping berhasil"
  },
  "response": {
    "sep": "0301R0010124020001",
    "cbg": {
      "code": "E-4-17-O",
      "description": "Diabetes tanpa komplikasi, rawat jalan",
      "tariff": 180000.00,
      "tariff_base": 180000.00,
      "top_up_tariff": 0
    },
    "hospital_tariff": 250000.00,
    "difference": -70000.00,
    "grouper_version": "5.10.0",
    "severity_level": "O"
  }
}
```

---

## Alur 3: IGD dengan Operasi

### Skenario
Pasien masuk via IGD dengan diagnosis Appendicitis, dilakukan operasi, rawat inap 3 hari.

### State Flow
```
DRAFT → IDRG_GROUPED → IDRG_FINAL → INACBG_GROUPED → INACBG_FINAL → CLAIM_FINAL → SENT
```

### Step 1: Input Data Klaim (State: DRAFT)

**Request:**
```json
{
  "metadata": {
    "method": "save_draft"
  },
  "data": {
    "nomor_sep": "0301R0010124030001",
    "nomor_kartu": "0001234567892",
    "tgl_masuk": "2024-01-22",
    "tgl_pulang": "2024-01-24",
    "cara_masuk": "1",
    "jenis_rawat": "1",
    "kelas_rawat": "3",
    "adl_sub_acute": "0",
    "adl_chronic": "0",
    "icu_indikator": "0",
    "icu_los": "0",
    "ventilator_hour": "0",
    "ventilator": "0",
    "dialpirah": "0",
    "upgrade_class_ind": "0",
    "upgrade_class_class": "",
    "upgrade_class_los": "0",
    "add_payment_pct": "0",
    "birth_weight": "0",
    "discharge_status": "1",
    "diagnosa": [
      {"code": "K35.8", "type": "UTAMA"},
      {"code": "K65.0", "type": "SEKUNDER"}
    ],
    "procedure": [
      {"code": "47.09", "multiplicity": 1, "setting": "OR"}
    ],
    "tarif_rs": 12500000.00,
    "coder_nik": "3374011234567890"
  }
}
```

### Step 2: Grouping iDRG

**Response:**
```json
{
  "metadata": {
    "code": "200",
    "message": "Grouping iDRG berhasil"
  },
  "response": {
    "sep": "0301R0010124030001",
    "idrg": {
      "code": "G-1-11-02",
      "description": "Appendectomy dengan komplikasi",
      "tariff": 10500000.00,
      "severity_level": "2"
    },
    "status": "VALID",
    "diagnoses_processed": [
      {"code": "K35.8", "name": "Acute appendicitis, other and unspecified", "type": "UTAMA", "valid": true},
      {"code": "K65.0", "name": "Generalized (acute) peritonitis", "type": "SEKUNDER", "valid": true}
    ],
    "procedures_processed": [
      {"code": "47.09", "name": "Other appendectomy", "multiplicity": 1, "setting": "OR", "valid": true}
    ]
  }
}
```

### Step 3-8: (Ikuti Alur Standar)

### Response Grouping INACBG:
```json
{
  "metadata": {
    "code": "200",
    "message": "Grouping berhasil"
  },
  "response": {
    "sep": "0301R0010124030001",
    "cbg": {
      "code": "G-1-11-II",
      "description": "Appendectomy dengan komplikasi, sedang",
      "tariff": 10500000.00,
      "tariff_base": 9800000.00,
      "top_up_tariff": 700000.00
    },
    "hospital_tariff": 12500000.00,
    "difference": -2000000.00,
    "grouper_version": "5.10.0",
    "severity_level": "II",
    "diagnoses_processed": [
      {"code": "K35.8", "name": "Acute appendicitis, other and unspecified", "type": "UTAMA"},
      {"code": "K65.0", "name": "Acute peritonitis", "type": "SEKUNDER"}
    ],
    "procedures_processed": [
      {"code": "47.09", "name": "Other appendectomy", "type": "UTAMA"}
    ],
    "special_case": []
  }
}
```

---

## Alur 4: Edit Ulang iDRG (Koreksi Sebelum Final Klaim)

### Skenario
Setelah grouping iDRG, petugas melihat perlu menambah diagnosis sekunder. Tombol **Edit Ulang iDRG** tersedia hingga status CLAIM_FINAL.

### Kriteria #9: Tombol Edit Ulang iDRG
> **Edit ulang iDRG hanya bisa dilakukan sampai finalisasi Klaim.**

### State Flow Edit Ulang
```
IDRG_GROUPED/IDRG_FINAL/INACBG_GROUPED/INACBG_FINAL → (Edit Ulang iDRG) → DRAFT
```

### Step 1: Cek Status Klaim

**Request:**
```json
{
  "metadata": {
    "method": "get_claim_data"
  },
  "data": {
    "nomor_sep": "0301R0010124010001"
  }
}
```

**Response:**
```json
{
  "metadata": {
    "code": "200",
    "message": "OK"
  },
  "response": {
    "sep": "0301R0010124010001",
    "status": "IDRG_FINAL",
    "idrg_code": "J-4-14-01",
    "idrg_tariff": 4850000.00,
    "diagnoses": [
      {"code": "J18.9", "type": "UTAMA"}
    ],
    "procedures": [
      {"code": "93.94", "multiplicity": 3, "setting": "NON_OR"}
    ],
    "can_edit_idrg": true,
    "can_edit_inacbg": false
  }
}
```

### Step 2: Klik Tombol "Edit Ulang iDRG"

**Request:**
```json
{
  "metadata": {
    "method": "reedit_idrg"
  },
  "data": {
    "nomor_sep": "0301R0010124010001",
    "coder_nik": "3374011234567890"
  }
}
```

**Response:**
```json
{
  "metadata": {
    "code": "200",
    "message": "Status dikembalikan ke DRAFT untuk edit iDRG"
  },
  "response": {
    "sep": "0301R0010124010001",
    "status": "DRAFT",
    "form_enabled": true
  }
}
```

**Setelah Edit Ulang:**
- ✅ Form input data klaim menjadi **ENABLED**
- ✅ Semua field bisa diubah
- ❌ Status IDRG_FINAL dan INACBG (jika ada) **DIBATALKAN**
- ✅ Harus **Grouping iDRG ulang**

### Step 3: Update Data Klaim (Tambah Diagnosis)

**Request:**
```json
{
  "metadata": {
    "method": "set_claim_data"
  },
  "data": {
    "nomor_sep": "0301R0010124010001",
    "tgl_masuk": "2024-01-15",
    "tgl_pulang": "2024-01-18",
    "cara_masuk": "2",
    "jenis_rawat": "1",
    "kelas_rawat": "3",
    "diagnosa": [
      {"code": "J18.9", "type": "UTAMA"},
      {"code": "J96.0", "type": "SEKUNDER"},
      {"code": "E11.9", "type": "SEKUNDER"}
    ],
    "procedure": [
      {"code": "93.94", "multiplicity": 3, "setting": "NON_OR"},
      {"code": "96.71", "multiplicity": 1, "setting": "ICU"}
    ],
    "tarif_rs": 5500000.00,
    "discharge_status": "1",
    "coder_nik": "3374011234567890"
  }
}
```

**Response:**
```json
{
  "metadata": {
    "code": "200",
    "message": "Data klaim berhasil diupdate"
  },
  "response": {
    "sep": "0301R0010124010001",
    "status": "DRAFT"
  }
}
```

### Step 4: Grouping iDRG Ulang

**Request:**
```json
{
  "metadata": {
    "method": "grouper_idrg"
  },
  "data": {
    "nomor_sep": "0301R0010124010001"
  }
}
```

**Response (Tarif Naik karena CC/MCC):**
```json
{
  "metadata": {
    "code": "200",
    "message": "Grouping iDRG berhasil"
  },
  "response": {
    "sep": "0301R0010124010001",
    "idrg": {
      "code": "J-4-14-02",
      "description": "Pneumonia dengan komplikasi sedang",
      "tariff": 6200000.00,
      "severity_level": "2"
    },
    "status": "VALID",
    "diagnoses_processed": [
      {"code": "J18.9", "name": "Pneumonia, unspecified organism", "type": "UTAMA", "valid": true},
      {"code": "J96.0", "name": "Acute respiratory failure", "type": "CC", "valid": true},
      {"code": "E11.9", "name": "Type 2 diabetes mellitus", "type": "SEKUNDER", "valid": true}
    ],
    "procedures_processed": [
      {"code": "93.94", "name": "Respiratory medication by nebulizer", "multiplicity": 3, "setting": "NON_OR", "valid": true},
      {"code": "96.71", "name": "Continuous invasive mechanical ventilation", "multiplicity": 1, "setting": "ICU", "valid": true}
    ]
  }
}
```

**UI Perbandingan:**
```
┌────────────────────────────────────────────────────────┐
│ HASIL RE-GROUPING iDRG                                 │
├────────────────────────────────────────────────────────┤
│                    │ SEBELUM      │ SESUDAH            │
├────────────────────┼──────────────┼────────────────────┤
│ Kode iDRG          │ J-4-14-01    │ J-4-14-02 ✅       │
│ Deskripsi          │ Tanpa Kmplk  │ Komplikasi Sedang  │
│ Severity           │ Level 1      │ Level 2 ⬆️         │
│ Tarif iDRG         │ Rp 4.850.000 │ Rp 6.200.000 ⬆️    │
├────────────────────────────────────────────────────────┤
│ Selisih Naik: Rp 1.350.000                             │
├────────────────────────────────────────────────────────┤
│ [Grouping Ulang]               [✓ Final iDRG]          │
└────────────────────────────────────────────────────────┘
```

---

## Alur 5: Edit Ulang INACBG (Koreksi Setelah iDRG Final)

### Skenario
Setelah grouping INACBG, petugas perlu menyesuaikan kode karena warning IM.

### Kriteria #12: Tombol Edit Ulang INACBG
> **Edit ulang INACBG hanya bisa dilakukan sampai finalisasi Klaim.**

### State Flow Edit Ulang INACBG
```
INACBG_GROUPED/INACBG_FINAL → (Edit Ulang INACBG) → IDRG_FINAL (section INACBG enabled)
```

### Step 1: Klik Tombol "Edit Ulang INACBG"

**Request:**
```json
{
  "metadata": {
    "method": "reedit_inacbg"
  },
  "data": {
    "nomor_sep": "0301R0010124010001",
    "coder_nik": "3374011234567890"
  }
}
```

**Response:**
```json
{
  "metadata": {
    "code": "200",
    "message": "Status dikembalikan untuk edit INACBG"
  },
  "response": {
    "sep": "0301R0010124010001",
    "status": "IDRG_FINAL",
    "inacbg_section_enabled": true,
    "idrg_section_locked": true
  }
}
```

**Setelah Edit Ulang INACBG:**
- ✅ Section INACBG menjadi **ENABLED**
- ❌ Section iDRG tetap **LOCKED**
- ❌ Status INACBG_FINAL **DIBATALKAN**
- ✅ Harus **Grouping INACBG ulang**

### Step 2: Sesuaikan Kode INACBG (Ganti IM → Standard)

**Request:**
```json
{
  "metadata": {
    "method": "set_inacbg_data"
  },
  "data": {
    "nomor_sep": "0301R0010124010001",
    "diagnosa_inagrouper": [
      {"code": "J18.9", "type": "UTAMA"},
      {"code": "J96.0", "type": "SEKUNDER"},
      {"code": "E11.9", "type": "SEKUNDER"}
    ],
    "procedure_inagrouper": [
      {"code": "93.94", "multiplicity": 3},
      {"code": "96.71", "multiplicity": 1}
    ],
    "coder_nik": "3374011234567890"
  }
}
```

### Step 3: Grouping INACBG Ulang

**Request:**
```json
{
  "metadata": {
    "method": "grouper"
  },
  "data": {
    "nomor_sep": "0301R0010124010001"
  }
}
```

**Response (Tarif Naik):**
```json
{
  "metadata": {
    "code": "200",
    "message": "Grouping berhasil"
  },
  "response": {
    "sep": "0301R0010124010001",
    "cbg": {
      "code": "J-4-14-II",
      "description": "Pneumonia dengan komplikasi, sedang",
      "tariff": 6200000.00,
      "tariff_base": 5800000.00,
      "top_up_tariff": 400000.00
    },
    "hospital_tariff": 5500000.00,
    "difference": 700000.00,
    "grouper_version": "5.10.0",
    "severity_level": "II",
    "diagnoses_processed": [
      {"code": "J18.9", "name": "Pneumonia, unspecified organism", "type": "UTAMA"},
      {"code": "J96.0", "name": "Acute respiratory failure", "type": "SEKUNDER"},
      {"code": "E11.9", "name": "Type 2 diabetes mellitus without complications", "type": "SEKUNDER"}
    ],
    "procedures_processed": [
      {"code": "93.94", "name": "Respiratory medication administered by nebulizer", "type": "UTAMA"},
      {"code": "96.71", "name": "Continuous invasive mechanical ventilation", "type": "UTAMA"}
    ]
  }
}
```

**UI Display:**
```
┌────────────────────────────────────────────────┐
│ HASIL RE-GROUPING INA-CBG                      │
├────────────────────────────────────────────────┤
│ Kode CBG     : J-4-14-II (naik dari I)         │
│ Deskripsi    : Pneumonia dengan komplikasi     │
│ Severity     : Level II (Sedang) ↑             │
├────────────────────────────────────────────────┤
│ Tarif RS     : Rp  5.500.000                   │
│ Tarif CBG    : Rp  6.200.000                   │
│ Selisih      : Rp   +700.000 (✅ Untung)        │
├────────────────────────────────────────────────┤
│ Diagnosis ditambahkan:                         │
│ + J96.0 - Acute respiratory failure            │
│ + E11.9 - Type 2 diabetes mellitus             │
│ Prosedur ditambahkan:                          │
│ + 96.71 - Continuous mechanical ventilation    │
├────────────────────────────────────────────────┤
│ [Finalisasi]                                   │
└────────────────────────────────────────────────┘
```

---

## Alur 6: Dispute/Reedit Klaim (Setelah Kirim)

### Skenario
Klaim sudah dikirim, namun ditolak oleh verifikator BPJS.

### Kriteria #23: Cek Status Klaim
> **Fitur cek status klaim.**

### Step 1: Cek Status Klaim

**Request:**
```json
{
  "metadata": {
    "method": "get_claim_status"
  },
  "data": {
    "tgl_masuk_from": "2024-01-01",
    "tgl_masuk_to": "2024-01-31",
    "jenis_rawat": "1",
    "status": "TIDAK_LAYAK"
  }
}
```

**Response:**
```json
{
  "metadata": {
    "code": "200",
    "message": "OK"
  },
  "response": {
    "total": 2,
    "claims": [
      {
        "sep": "0301R0010124010001",
        "nama_pasien": "JOHN DOE",
        "tgl_masuk": "2024-01-15",
        "tgl_pulang": "2024-01-18",
        "idrg_code": "J-4-14-02",
        "cbg_code": "J-4-14-II",
        "cbg_tariff": 6200000.00,
        "status": "TIDAK_LAYAK",
        "verification_date": "2024-01-25",
        "verified_by": "dr. Verifikator, SpPD",
        "notes": "Diagnosis sekunder J96.0 tidak didukung hasil lab/pemeriksaan di RM"
      }
    ]
  }
}
```

### Step 2: Cancel Klaim yang Sudah Dikirim

**Request:**
```json
{
  "metadata": {
    "method": "claim_cancel"
  },
  "data": {
    "nomor_sep": "0301R0010124010001",
    "reason": "Koreksi diagnosis berdasarkan hasil verifikasi"
  }
}
```

**Response:**
```json
{
  "metadata": {
    "code": "200",
    "message": "Finalisasi berhasil dibatalkan"
  },
  "response": {
    "sep": "0301R0010124010001",
    "status": "CANCELLED"
  }
}
```

### Step 3: Kembali ke DRAFT → Ulangi Alur iDRG

Setelah cancel, status kembali ke DRAFT dan harus:
1. Edit data klaim
2. Grouping iDRG ulang
3. Final iDRG
4. Import ke INACBG
5. Grouping INACBG
6. Final INACBG
7. Final Klaim
8. Kirim Klaim

---

## Alur 7: Khusus ICU

### Skenario
Pasien dengan ARDS dirawat di ICU selama 5 hari dengan ventilator.

### State Flow (Sama dengan Standar)
```
DRAFT → IDRG_GROUPED → IDRG_FINAL → INACBG_GROUPED → INACBG_FINAL → CLAIM_FINAL → SENT
```

### Input Data Klaim dengan ICU (State: DRAFT)

```json
{
  "metadata": {
    "method": "save_draft"
  },
  "data": {
    "nomor_sep": "0301R0010124040001",
    "nomor_kartu": "0001234567893",
    "tgl_masuk": "2024-01-25",
    "tgl_pulang": "2024-02-01",
    "cara_masuk": "1",
    "jenis_rawat": "1",
    "kelas_rawat": "3",
    "adl_sub_acute": "0",
    "adl_chronic": "0",
    "icu_indikator": "1",
    "icu_los": "5",
    "ventilator_hour": "120",
    "ventilator": "1",
    "dialpirah": "0",
    "upgrade_class_ind": "0",
    "upgrade_class_class": "",
    "upgrade_class_los": "0",
    "add_payment_pct": "0",
    "birth_weight": "0",
    "discharge_status": "1",
    "diagnosa": [
      {"code": "J80", "type": "UTAMA"},
      {"code": "J96.0", "type": "SEKUNDER"},
      {"code": "A41.9", "type": "SEKUNDER"}
    ],
    "procedure": [
      {"code": "96.71", "multiplicity": 5, "setting": "ICU"},
      {"code": "96.72", "multiplicity": 5, "setting": "ICU"},
      {"code": "93.90", "multiplicity": 7, "setting": "ICU"}
    ],
    "tarif_rs": 85000000.00,
    "icu_los_ec": "5",
    "special_icu": "IC",
    "coder_nik": "3374011234567890"
  }
}
```

### Grouping iDRG Response dengan ICU

```json
{
  "metadata": {
    "code": "200",
    "message": "Grouping iDRG berhasil"
  },
  "response": {
    "sep": "0301R0010124040001",
    "idrg": {
      "code": "J-4-10-03",
      "description": "Respiratory failure, Berat dengan ICU",
      "tariff": 75000000.00,
      "severity_level": "3"
    },
    "status": "VALID",
    "special_case": [
      {
        "type": "ICU",
        "description": "Perawatan ICU",
        "days": 5
      },
      {
        "type": "VENTILATOR",
        "description": "Penggunaan Ventilator",
        "hours": 120
      }
    ]
  }
}
```

### Grouping INACBG Response dengan Top-Up ICU

```json
{
  "metadata": {
    "code": "200",
    "message": "Grouping berhasil"
  },
  "response": {
    "sep": "0301R0010124040001",
    "cbg": {
      "code": "J-4-10-III",
      "description": "Respiratory failure, Berat",
      "tariff": 45000000.00,
      "tariff_base": 35000000.00,
      "top_up_tariff": 10000000.00
    },
    "hospital_tariff": 85000000.00,
    "difference": -40000000.00,
    "grouper_version": "5.10.0",
    "severity_level": "III",
    "special_case": [
      {
        "type": "ICU",
        "description": "Perawatan ICU",
        "days": 5,
        "additional_tariff": 25000000.00
      },
      {
        "type": "VENTILATOR",
        "description": "Penggunaan Ventilator",
        "hours": 120,
        "additional_tariff": 15000000.00
      }
    ],
    "total_cbg_tariff": 85000000.00
  }
}
```

---

## Alur 8: Khusus Neonatus

### Skenario
Bayi lahir prematur dengan BBLR (Berat Badan Lahir Rendah) 1800 gram.

### State Flow (Sama dengan Standar)
```
DRAFT → IDRG_GROUPED → IDRG_FINAL → INACBG_GROUPED → INACBG_FINAL → CLAIM_FINAL → SENT
```

### Input Data Klaim Neonatus (State: DRAFT)

```json
{
  "metadata": {
    "method": "save_draft"
  },
  "data": {
    "nomor_sep": "0301R0010124050001",
    "nomor_kartu": "0001234567894",
    "tgl_masuk": "2024-01-28",
    "tgl_pulang": "2024-02-10",
    "cara_masuk": "4",
    "jenis_rawat": "1",
    "kelas_rawat": "3",
    "adl_sub_acute": "0",
    "adl_chronic": "0",
    "icu_indikator": "0",
    "icu_los": "0",
    "ventilator_hour": "0",
    "ventilator": "0",
    "dialpirah": "0",
    "upgrade_class_ind": "0",
    "upgrade_class_class": "",
    "upgrade_class_los": "0",
    "add_payment_pct": "0",
    "birth_weight": "1800",
    "discharge_status": "1",
    "diagnosa": [
      {"code": "P07.1", "type": "UTAMA"},
      {"code": "P22.0", "type": "SEKUNDER"},
      {"code": "P59.9", "type": "SEKUNDER"}
    ],
    "procedure": [
      {"code": "99.15", "multiplicity": 1, "setting": "NON_OR"}
    ],
    "tarif_rs": 15000000.00,
    "coder_nik": "3374011234567890"
  }
}
```

**Catatan Khusus Neonatus:**
- `cara_masuk: "4"` = Bayi lahir di RS
- `birth_weight` WAJIB diisi untuk diagnosis P07.x
- Diagnosis utama harus kode P (Neonatal)

### Grouping iDRG Response Neonatus

```json
{
  "metadata": {
    "code": "200",
    "message": "Grouping iDRG berhasil"
  },
  "response": {
    "sep": "0301R0010124050001",
    "idrg": {
      "code": "P-3-15-02",
      "description": "BBLR 1500-1999 gram dengan komplikasi",
      "tariff": 12500000.00,
      "severity_level": "2"
    },
    "status": "VALID",
    "birth_weight_category": "1500-1999g",
    "diagnoses_processed": [
      {"code": "P07.1", "name": "Other low birth weight", "type": "UTAMA", "valid": true},
      {"code": "P22.0", "name": "Respiratory distress syndrome of newborn", "type": "SEKUNDER", "valid": true},
      {"code": "P59.9", "name": "Neonatal jaundice, unspecified", "type": "SEKUNDER", "valid": true}
    ]
  }
}
```

### Grouping INACBG Response Neonatus

```json
{
  "metadata": {
    "code": "200",
    "message": "Grouping berhasil"
  },
  "response": {
    "sep": "0301R0010124050001",
    "cbg": {
      "code": "P-3-15-II",
      "description": "BBLR 1500-1999 gram, sedang",
      "tariff": 12500000.00,
      "tariff_base": 11000000.00,
      "top_up_tariff": 1500000.00
    },
    "hospital_tariff": 15000000.00,
    "difference": -2500000.00,
    "grouper_version": "5.10.0",
    "severity_level": "II",
    "birth_weight_category": "1500-1999g",
    "diagnoses_processed": [
      {"code": "P07.1", "name": "Other low birth weight", "type": "UTAMA"},
      {"code": "P22.0", "name": "Respiratory distress syndrome of newborn", "type": "SEKUNDER"},
      {"code": "P59.9", "name": "Neonatal jaundice, unspecified", "type": "SEKUNDER"}
    ]
  }
}
```

---

## Mapping Field dari SIMRS

### Dari Visit ke E-Klaim

| Field E-Klaim | Source SIMRS | Mapping |
|---------------|--------------|---------|
| `nomor_sep` | Manual/VClaim | Input user / API VClaim |
| `nomor_kartu` | `registrations.bpjs_number` | Direct |
| `tgl_masuk` | `visits.created_at` | Format YYYY-MM-DD |
| `tgl_pulang` | `visits.completed_at` | Format YYYY-MM-DD |
| `cara_masuk` | `registrations.service_type` | IGD=1, Poli=2 |
| `jenis_rawat` | `registrations.service_type` | RI=1, RJ=2 |
| `kelas_rawat` | `registrations.patient_class` | Map to 1/2/3 |
| `diagnosa` | `visit_diagnoses` | Join with comma |
| `procedure` | `visit_procedures` / `procedure_orders` | Join with comma |
| `tarif_rs` | `billings.final_amount` | Direct |
| `discharge_status` | `visits.discharge_type` | Map to 1-5 |
| `coder_nik` | `users.nik` | Current user NIK |

### Mapping Cara Masuk

```go
func mapCaraMasuk(serviceType string) string {
    switch serviceType {
    case "gawat_darurat":
        return "1" // IGD
    case "rawat_jalan":
        return "2" // Poliklinik
    case "rawat_inap":
        return "2" // Default poliklinik (dari admisi)
    default:
        return "2"
    }
}
```

### Mapping Discharge Status

```go
func mapDischargeStatus(dischargeType string) string {
    switch dischargeType {
    case "sehat", "membaik":
        return "1" // Pulang persetujuan dokter
    case "paksa":
        return "2" // Pulang paksa
    case "aps":
        return "3" // Pulang atas permintaan sendiri
    case "meninggal":
        return "4" // Meninggal
    case "rujuk":
        return "5" // Rujuk keluar
    default:
        return "1"
    }
}
```

### Format Diagnosis (Multiple)

```go
func formatDiagnoses(diagnoses []VisitDiagnosis) string {
    var codes []string
    // Primary diagnosis first
    for _, d := range diagnoses {
        if d.IsPrimary {
            codes = append([]string{d.ICDCode}, codes...)
        } else {
            codes = append(codes, d.ICDCode)
        }
    }
    return strings.Join(codes, ",")
}
```

---

## Summary: Alur iDRG per Kasus (Sesuai KEMENKES)

| Alur | Skenario | Endpoints Called |
|------|----------|------------------|
| **Rawat Inap** | Standar | save_draft → grouper_idrg → final_idrg → import_to_inacbg → grouper → final_inacbg → claim_final → send_claim |
| **Rawat Jalan** | Standar | save_draft → grouper_idrg → final_idrg → import_to_inacbg → grouper → final_inacbg → claim_final → send_claim |
| **IGD** | Operasi | save_draft → grouper_idrg → final_idrg → import_to_inacbg → grouper → final_inacbg → claim_final → send_claim |
| **Edit Ulang iDRG** | Koreksi sebelum Final Klaim | reedit_idrg → set_claim_data → grouper_idrg → ... (ulangi) |
| **Edit Ulang INACBG** | Koreksi INACBG | reedit_inacbg → set_inacbg_data → grouper → ... (lanjut) |
| **Dispute** | Ditolak verifikator | claim_cancel → set_claim_data → grouper_idrg → ... (ulangi dari awal) |
| **ICU** | Dengan ventilator | save_draft (icu fields) → grouper_idrg → final_idrg → grouper → final_inacbg → claim_final → send_claim |
| **Neonatus** | BBLR | save_draft (birth_weight) → grouper_idrg → final_idrg → grouper → final_inacbg → claim_final → send_claim |

### State Transition Summary

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            STATE MACHINE E-KLAIM                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  DRAFT ──► IDRG_GROUPED ──► IDRG_FINAL ──► INACBG_GROUPED ──► INACBG_FINAL     │
│    │            │               │               │                  │            │
│    │            │               │               │                  │            │
│    │       [Edit Data]    [Edit Ulang      [Edit INACBG]    [Edit Ulang        │
│    │            │          iDRG]               │             INACBG]           │
│    │            │               │               │                  │            │
│    └────────────┴───────────────┴───────────────┴──────────────────┘            │
│                                                                                 │
│                                                        │                        │
│                                                        ▼                        │
│                                               CLAIM_FINAL                       │
│                                                   │                             │
│                                         [Kirim Klaim]                           │
│                                                   │                             │
│                                                   ▼                             │
│                                                 SENT                            │
│                                                   │                             │
│                                       [Verifikasi BPJS]                         │
│                                                   │                             │
│                               ┌───────────────────┼───────────────────┐         │
│                               ▼                   ▼                   ▼         │
│                            LAYAK            TIDAK_LAYAK           DISPUTE       │
│                                                   │                             │
│                                          [Claim Cancel]                         │
│                                                   │                             │
│                                                   ▼                             │
│                                             CANCELLED                           │
│                                                   │                             │
│                                          [Kembali ke DRAFT]                     │
│                                                   │                             │
│                                                   ▼                             │
│                                                DRAFT                            │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Checklist Implementasi (Sesuai 25 Kriteria KEMENKES)

### Backend
- [ ] Model: `EklaimClaim` dengan state machine
- [ ] Model: `EklaimConfig` (cons_id, secret_key, etc)
- [ ] Service: `services/eklaim/client.go` (HMAC-SHA256 signature)
- [ ] Handler: `handlers/eklaim.go`
  - [ ] `POST /eklaim/draft` - save_draft
  - [ ] `POST /eklaim/grouper-idrg` - grouper_idrg
  - [ ] `POST /eklaim/final-idrg` - final_idrg
  - [ ] `POST /eklaim/import-inacbg` - import_idrg_to_inacbg
  - [ ] `POST /eklaim/grouper-inacbg` - grouper
  - [ ] `POST /eklaim/final-inacbg` - final_inacbg
  - [ ] `POST /eklaim/final-claim` - claim_final
  - [ ] `POST /eklaim/send` - send_claim
  - [ ] `POST /eklaim/reedit-idrg` - reedit_idrg
  - [ ] `POST /eklaim/reedit-inacbg` - reedit_inacbg
  - [ ] `POST /eklaim/cancel` - claim_cancel
  - [ ] `GET /eklaim/status` - get_claim_status
- [ ] Routes: `routes/eklaim.go`
- [ ] ICD-10 2010 IM validator (Kriteria #1)
- [ ] ICD-9-CM 2010 IM validator (Kriteria #2)
- [ ] Multiplicity + Setting on procedures (Kriteria #3)

### Frontend
- [ ] Page: `/eklaim` - Daftar Klaim dengan filter status
- [ ] Page: `/eklaim/new` - Entry Klaim Baru (State: DRAFT)
- [ ] Page: `/eklaim/:id` - Detail Klaim dengan conditional buttons
- [ ] Component: `EklaimForm` - Form dengan disabled state per status
- [ ] Component: `IDRGGroupingResult` - Hasil grouping iDRG
- [ ] Component: `INACBGGroupingResult` - Hasil grouping INACBG
- [ ] Component: `ImportWarning` - Warning IM codes
- [ ] Component: `ProcedureInput` - Input dengan multiplicity + setting
- [ ] Component: `ClaimStatusBadge` - Badge per state
- [ ] Component: `ButtonVisibility` - Tombol kondisional per state

### Integration
- [ ] Auto-populate dari Visit (diagnoses, procedures, billing)
- [ ] Sync hasil grouping ke billing (Kriteria #25)
- [ ] Notifikasi status klaim via SSE
- [ ] Report: Klaim per periode dengan status breakdown
