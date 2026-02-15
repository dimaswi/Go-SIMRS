# Dokumentasi API E-Klaim BPJS Kesehatan

## Daftar Isi

1. [Pendahuluan](#pendahuluan)
2. [Arsitektur E-Klaim](#arsitektur-e-klaim)
3. [Alur Kerja E-Klaim](#alur-kerja-e-klaim)
4. [Konfigurasi dan Autentikasi](#konfigurasi-dan-autentikasi)
5. [Function API E-Klaim](#function-api-e-klaim)
6. [JSON Request/Response](#json-requestresponse)
7. [Integrasi dengan SIMRS](#integrasi-dengan-simrs)
8. [Error Handling](#error-handling)
9. [Kriteria iDRG](#kriteria-idrg)

---

## Pendahuluan

E-Klaim adalah sistem pengajuan klaim pelayanan kesehatan BPJS yang menggunakan metode **INA-CBG (Indonesian Case Based Groups)** untuk menghitung tarif pelayanan berdasarkan diagnosis dan prosedur yang dilakukan.

### Perbedaan VClaim vs E-Klaim

| Aspek      | VClaim                                    | E-Klaim                         |
| ---------- | ----------------------------------------- | ------------------------------- |
| Fungsi     | SEP (Surat Eligibilitas Peserta), Rujukan | Klaim biaya pelayanan (INA-CBG) |
| Trigger    | Saat pasien datang/registrasi             | Setelah pasien pulang           |
| Output     | Nomor SEP                                 | Tarif klaim INA-CBG             |
| Dependency | Diperlukan untuk E-Klaim                  | Memerlukan data SEP dari VClaim |

### Tanpa SEP? Alternatif dengan Entry Manual

Jika belum terintegrasi VClaim, E-Klaim masih bisa digunakan dengan:

1. **Entry SEP Manual** - Input nomor SEP yang sudah ada dari sistem lain
2. **Entry Data Peserta Manual** - Input data peserta BPJS secara manual

---

## Arsitektur E-Klaim

```
┌─────────────────────────────────────────────────────────────────────┐
│                          SIMRS Go-SIMRS                            │
├─────────────────────────────────────────────────────────────────────┤
│  Frontend (React)                                                   │
│  └── Pages: /eklaim/*                                              │
│      ├── Daftar Klaim                                              │
│      ├── Entry Klaim Baru                                          │
│      ├── Grouping (INA-CBG)                                        │
│      └── Monitoring Status                                         │
├─────────────────────────────────────────────────────────────────────┤
│  Backend (Go/Gin)                                                   │
│  └── handlers/eklaim.go                                            │
│      ├── CreateClaim         POST   /api/eklaim/claims             │
│      ├── UpdateClaim         PUT    /api/eklaim/claims/:id         │
│      ├── DeleteClaim         DELETE /api/eklaim/claims/:id         │
│      ├── GrouperClaim        POST   /api/eklaim/claims/:id/grouper │
│      ├── FinalizeClaim       POST   /api/eklaim/claims/:id/final   │
│      └── GetClaimStatus      GET    /api/eklaim/claims/:id/status  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ HTTP/HTTPS
┌─────────────────────────────────────────────────────────────────────┐
│                      E-Klaim Web Service BPJS                       │
│                     (eklaim.bpjs-kesehatan.go.id)                   │
├─────────────────────────────────────────────────────────────────────┤
│  Base URL:                                                          │
│  - DEV:  https://dvlp.bpjs-kesehatan.go.id:9081/api/eklaim         │
│  - PROD: https://eklaim.bpjs-kesehatan.go.id/api/eklaim            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Alur Kerja E-Klaim

### Alur UX Lengkap

```
┌─────────────────────────────────────────────────────────────────────┐
│  ALUR E-KLAIM RAWAT INAP                                           │
└─────────────────────────────────────────────────────────────────────┘

[1. PASIEN PULANG]
     │
     ▼
[2. BILLING FINALIZED]
     │ Trigger: Visit completed + Billing paid/finalized
     ▼
[3. CREATE CLAIM ENTRY]
     │ Input: Data pasien, SEP, diagnosa, prosedur
     │ API: new_claim
     ▼
[4. GROUPING / INA-CBG]
     │ Input: Nomor klaim
     │ API: grouper
     │ Output: Kode INA-CBG, Tarif RS, Tarif Klaim
     ▼
[5. REVIEW & EDIT] ◄────────────────────┐
     │ Cek selisih tarif                │
     │ Edit diagnosis/prosedur jika perlu
     ▼                                   │
[6. RE-GROUPING] ────────────────────────┘
     │ Jika ada perubahan
     ▼
[7. FINALISASI KLAIM]
     │ API: claim_final (kirim klaim)
     │ Status: Pending → Diajukan
     ▼
[8. MONITORING]
     │ API: get_claim_data
     │ Cek status klaim
     ▼
[9. VERIFIKASI BPJS]
     │ Proses di BPJS
     │ Status: Layak/Tidak Layak
     ▼
[10. PEMBAYARAN]
     │ Transfer ke rekening RS
     └───────────────────────────────────
```

### Alur Khusus Rawat Jalan

```
[PASIEN SELESAI RAWAT JALAN]
     │
     ▼
[BILLING SELESAI]
     │
     ▼
[CREATE CLAIM - RAWAT JALAN]
     │ jnspelayanan: 2
     ▼
[GROUPING]
     │ Langsung dapat tarif paket
     ▼
[FINALISASI]
```

---

## Konfigurasi dan Autentikasi

### Environment Variables

```env
# E-Klaim Configuration
EKLAIM_BASE_URL=https://dvlp.bpjs-kesehatan.go.id:9081/api/eklaim
EKLAIM_KODE_PPK=0301R001          # Kode PPK RS
EKLAIM_SECRET_KEY=your-secret-key  # Secret key dari BPJS
```

### Autentikasi Header

Setiap request ke E-Klaim memerlukan header:

```http
Content-Type: application/json; charset=utf-8
X-Cons-Id: <KODE_PPK>
X-Timestamp: <UNIX_TIMESTAMP>
X-Signature: <HMAC_SHA256_SIGNATURE>
```

### Generate Signature

```go
// Go implementation
func generateEklaimSignature(consID, secretKey string, timestamp int64) string {
    data := fmt.Sprintf("%s&%d", consID, timestamp)
    h := hmac.New(sha256.New, []byte(secretKey))
    h.Write([]byte(data))
    return base64.StdEncoding.EncodeToString(h.Sum(nil))
}
```

---

## Function API E-Klaim

### Daftar Function API

| No  | Function Name           | HTTP | Endpoint    | Deskripsi             |
| --- | ----------------------- | ---- | ----------- | --------------------- |
| 1   | `new_claim`             | POST | /api/eklaim | Membuat klaim baru    |
| 2   | `set_claim_data`        | POST | /api/eklaim | Update data klaim     |
| 3   | `delete_claim`          | POST | /api/eklaim | Hapus klaim           |
| 4   | `grouper`               | POST | /api/eklaim | Grouping INA-CBG      |
| 5   | `get_claim_data`        | POST | /api/eklaim | Ambil data klaim      |
| 6   | `claim_print`           | POST | /api/eklaim | Cetak resume klaim    |
| 7   | `claim_final`           | POST | /api/eklaim | Finalisasi klaim      |
| 8   | `claim_cancel`          | POST | /api/eklaim | Batalkan finalisasi   |
| 9   | `get_claim_status`      | POST | /api/eklaim | Status verifikasi     |
| 10  | `reedit_claim`          | POST | /api/eklaim | Re-edit klaim         |
| 11  | `send_suplesi`          | POST | /api/eklaim | Kirim suplesi         |
| 12  | `generate_sep_internal` | POST | /api/eklaim | Generate SEP Internal |

---

## JSON Request/Response

### 1. new_claim - Membuat Klaim Baru

#### Request

```json
{
  "metadata": {
    "method": "new_claim"
  },
  "data": {
    "nomor_kartu": "0000668870001",
    "nomor_sep": "0001R0016120507422",
    "nomor_rm": "123-45-67",
    "nama_pasien": "NAMA TEST PASIEN",
    "tgl_lahir": "1940-01-01 02:00:00",
    "gender": 2
  }
}
```

#### Response Success

```json
{
  "metadata": {
    "code": "200",
    "message": "OK"
  },
  "response": {
    "claim_id": "CL2024011500001",
    "status": "CREATED",
    "created_date": "2024-01-18 10:30:00"
  }
}
```

---

### 2. set_claim_data - Update Data Klaim

#### Request

```json
{
  "metadata": {
    "method": "set_claim_data",
    "nomor_sep": "0001R0016120507422"
  },
  "data": {
  "nomor_sep": "0001R0016120507422",
  "nomor_kartu": "233333",
  "tgl_masuk": "2023-01-25 12:55:00",
  "tgl_pulang": "2023-01-31 09:55:00",
  "cara_masuk": "gp",
  "jenis_rawat": "1",
  "kelas_rawat": "1",
  "adl_sub_acute": "15",
  "adl_chronic": "12",
  "icu_indikator": "1",
  "icu_los": "2",
  "ventilator_hour": "5",
  "ventilator": {
    "use_ind": "1",
    "start_dttm": "2023-01-26 12:55:00",
    "stop_dttm": "2023-02-26 17:50:00"
    },
  "upgrade_class_ind": "1",
  "upgrade_class_class": "vip",
  "upgrade_class_los": "5",
  "upgrade_class_payor": "peserta",
  "add_payment_pct": "35",
  "birth_weight": "0",
  "sistole": 120,
  "diastole": 70,
  "discharge_status": "1",
  "tarif_rs": {
    "prosedur_non_bedah": "300000",
    "prosedur_bedah": "20000000",
    "konsultasi": "300000",
    "tenaga_ahli": "200000",
    "keperawatan": "80000",
    "penunjang": "1000000",
    "radiologi": "500000",
    "laboratorium": "600000",
    "pelayanan_darah": "150000",
    "rehabilitasi": "100000",
    "kamar": "6000000",
    "rawat_intensif": "2500000",
    "obat": "100000",
    "obat_kronis": "1000000",
    "obat_kemoterapi": "5000000",
    "alkes": "500000",
    "bmhp": "400000",
    "sewa_alat": "210000"
  },
  "nomor_kartu_t": "nik",
  "bayi_lahir_status_cd": 1,
  "dializer_single_use": 0,
  "kantong_darah": 1,
  "alteplase_ind": 0,
  "apgar": {
    "menit_1": {
      "appearance": 1,
      "pulse": 2,
      "grimace": 1,
      "activity": 1,
      "respiration": 1
    },
    "menit_5": {
      "appearance": 2,
      "pulse": 2,
      "grimace": 2,
      "activity": 2,
      "respiration": 2
    }
  },
  "persalinan": {
  "usia_kehamilan": "22",
  "gravida": "2",
  "partus": "4",
  "abortus": "2",
  "onset_kontraksi": "induksi",
  "delivery": [
      {
        "delivery_sequence": "1",
        "delivery_method": "vaginal",
        "delivery_dttm": "2023-01-21 17:01:33",
        "letak_janin": "kepala",
        "kondisi": "livebirth",
        "use_manual": "1",
        "use_forcep": "0",
        "use_vacuum": "1",
        "shk_spesimen_ambil": "ya",
        "shk_lokasi": "tumit",
        "shk_spesimen_dttm": "2023-11-21 18:11:33"
      },
      {
        "delivery_sequence": "2",
        "delivery_method": "vaginal",
        "delivery_dttm": "2023-01-21 17:03:49",
        "letak_janin": "lintang",
        "kondisi": "livebirth",
        "use_manual": "1",
        "use_forcep": "0",
        "use_vacuum": "0",
        "shk_spesimen_ambil": "tidak",
        "shk_alasan": "akses-sulit"
      }
    ]
  },
  "tarif_poli_eks": "100000",
  "nama_dokter": "RUDY, DR",
  "kode_tarif": "AP",
  "payor_id": "3",
  "payor_cd": "JKN",
  "cob_cd": "0001",
  "coder_nik": "123123123123"
  }
}
```

#### Response Success

```json
{
  "metadata": {
    "code": "200",
    "message": "Data klaim berhasil diupdate"
  },
  "response": {
    "sep": "0301R0011123010001",
    "status": "UPDATED"
  }
}
```

---

### 3. grouper - Grouping INA-CBG

#### Request

```json
{
  "metadata": {
    "method": "grouper"
  },
  "data": {
    "nomor_sep": "0301R0011123010001"
  }
}
```

#### Response Success

```json
{
  "metadata": {
    "code": "200",
    "message": "Grouping berhasil"
  },
  "response": {
    "sep": "0301R0011123010001",
    "cbg": {
      "code": "G-4-14-I",
      "description": "Gastroenteritis & penyakit gastrointestinal lainnya, ringan",
      "tariff": 3180000.0,
      "tariff_base": 2975000.0,
      "top_up_tariff": 205000.0
    },
    "hospital_tariff": 2500000.0,
    "difference": 680000.0,
    "grouper_version": "5.10.0",
    "drg_type": "INA-CBG",
    "severity_level": "I",
    "special_case": []
  }
}
```

#### Response Error - Diagnosis Tidak Valid

```json
{
  "metadata": {
    "code": "301",
    "message": "Kode diagnosis tidak valid"
  },
  "response": {
    "errors": [
      {
        "field": "diagnosa",
        "code": "Z99.9",
        "message": "Kode diagnosis utama tidak boleh berupa kode Z"
      }
    ]
  }
}
```

---

### 4. get_claim_data - Ambil Data Klaim

#### Request

```json
{
  "metadata": {
    "method": "get_claim_data"
  },
  "data": {
    "nomor_sep": "0301R0011123010001"
  }
}
```

#### Response Success

```json
{
  "metadata": {
    "code": "200",
    "message": "OK"
  },
  "response": {
    "sep": "0301R0011123010001",
    "nomor_kartu": "0001234567890",
    "nama_pasien": "JOHN DOE",
    "tgl_lahir": "1980-05-15",
    "jenis_kelamin": "L",
    "kelas_rawat": "3",
    "tgl_masuk": "2024-01-15",
    "tgl_pulang": "2024-01-18",
    "jenis_rawat": "1",
    "cara_masuk": "1",
    "diagnosa": "A09.0,E11.9",
    "procedure": "99.29",
    "discharge_status": "1",
    "tarif_rs": 2500000.0,
    "cbg_code": "G-4-14-I",
    "cbg_tariff": 3180000.0,
    "status": {
      "grouper": "GROUPED",
      "final": "NOT_FINALIZED",
      "verification": ""
    },
    "claim_id": "CL2024011500001",
    "created_date": "2024-01-18 10:30:00",
    "updated_date": "2024-01-18 11:45:00"
  }
}
```

---

### 5. claim_final - Finalisasi Klaim

#### Request

```json
{
  "metadata": {
    "method": "claim_final"
  },
  "data": {
    "nomor_sep": "0301R0011123010001",
    "coder_nik": "1234567890123456"
  }
}
```

#### Response Success

```json
{
  "metadata": {
    "code": "200",
    "message": "Klaim berhasil dikirim untuk verifikasi"
  },
  "response": {
    "sep": "0301R0011123010001",
    "status": "FINALIZED",
    "finalized_date": "2024-01-18 14:00:00",
    "cbg_code": "G-4-14-I",
    "cbg_tariff": 3180000.0
  }
}
```

---

### 6. claim_cancel - Batalkan Finalisasi

#### Request

```json
{
  "metadata": {
    "method": "claim_cancel"
  },
  "data": {
    "nomor_sep": "0301R0011123010001",
    "reason": "Koreksi diagnosa utama"
  }
}
```

#### Response Success

```json
{
  "metadata": {
    "code": "200",
    "message": "Finalisasi berhasil dibatalkan"
  },
  "response": {
    "sep": "0301R0011123010001",
    "status": "CANCELLED",
    "cancelled_date": "2024-01-18 15:00:00"
  }
}
```

---

### 7. delete_claim - Hapus Klaim

#### Request

```json
{
  "metadata": {
    "method": "delete_claim"
  },
  "data": {
    "nomor_sep": "0301R0011123010001"
  }
}
```

#### Response Success

```json
{
  "metadata": {
    "code": "200",
    "message": "Klaim berhasil dihapus"
  },
  "response": {
    "sep": "0301R0011123010001",
    "status": "DELETED"
  }
}
```

---

### 8. get_claim_status - Status Verifikasi

#### Request

```json
{
  "metadata": {
    "method": "get_claim_status"
  },
  "data": {
    "tgl_masuk_from": "2024-01-01",
    "tgl_masuk_to": "2024-01-31",
    "jenis_rawat": "1",
    "status": ""
  }
}
```

#### Response Success

```json
{
  "metadata": {
    "code": "200",
    "message": "OK"
  },
  "response": {
    "total": 50,
    "claims": [
      {
        "sep": "0301R0011123010001",
        "nama_pasien": "JOHN DOE",
        "tgl_masuk": "2024-01-15",
        "tgl_pulang": "2024-01-18",
        "cbg_code": "G-4-14-I",
        "cbg_tariff": 3180000.0,
        "status": "LAYAK",
        "verification_date": "2024-01-25",
        "verified_by": "DR. VERIFIKATOR",
        "notes": ""
      },
      {
        "sep": "0301R0011123010002",
        "nama_pasien": "JANE DOE",
        "tgl_masuk": "2024-01-16",
        "tgl_pulang": "2024-01-19",
        "cbg_code": "J-4-13-II",
        "cbg_tariff": 4500000.0,
        "status": "TIDAK_LAYAK",
        "verification_date": "2024-01-26",
        "verified_by": "DR. VERIFIKATOR",
        "notes": "Diagnosis utama tidak sesuai dengan tindakan"
      }
    ]
  }
}
```

---

### 9. reedit_claim - Re-edit Klaim

Untuk klaim yang statusnya TIDAK_LAYAK dan perlu dikoreksi.

#### Request

```json
{
  "metadata": {
    "method": "reedit_claim"
  },
  "data": {
    "nomor_sep": "0301R0011123010002",
    "diagnosa": "J18.9",
    "procedure": "93.94",
    "coder_nik": "1234567890123456",
    "reason": "Koreksi berdasarkan hasil verifikasi"
  }
}
```

#### Response Success

```json
{
  "metadata": {
    "code": "200",
    "message": "Klaim berhasil di-reedit"
  },
  "response": {
    "sep": "0301R0011123010002",
    "status": "REEDITED"
  }
}
```

---

### 10. claim_print - Cetak Resume Klaim

#### Request

```json
{
  "metadata": {
    "method": "claim_print"
  },
  "data": {
    "nomor_sep": "0301R0011123010001"
  }
}
```

#### Response Success

```json
{
  "metadata": {
    "code": "200",
    "message": "OK"
  },
  "response": {
    "sep": "0301R0011123010001",
    "print_data": {
      "header": {
        "nama_rs": "RS CONTOH",
        "kode_ppk": "0301R001",
        "alamat_rs": "Jl. Contoh No. 1"
      },
      "pasien": {
        "nama": "JOHN DOE",
        "no_kartu": "0001234567890",
        "tgl_lahir": "1980-05-15",
        "jk": "L",
        "kelas_rawat": "3"
      },
      "pelayanan": {
        "tgl_masuk": "2024-01-15",
        "tgl_pulang": "2024-01-18",
        "los": 3,
        "jenis_rawat": "Rawat Inap"
      },
      "diagnosis": [
        {
          "kode": "A09.0",
          "nama": "Gastroenteritis dan colitis infeksius lainnya",
          "type": "UTAMA"
        },
        {
          "kode": "E11.9",
          "nama": "Diabetes melitus tipe 2 tanpa komplikasi",
          "type": "SEKUNDER"
        }
      ],
      "procedure": [
        { "kode": "99.29", "nama": "Injeksi/infus elektrolit lainnya" }
      ],
      "klaim": {
        "cbg_code": "G-4-14-I",
        "cbg_desc": "Gastroenteritis & penyakit gastrointestinal lainnya, ringan",
        "tarif_cbg": 3180000.0,
        "tarif_rs": 2500000.0
      }
    }
  }
}
```

---

### 11. generate_sep_internal - Generate SEP Internal

Untuk kasus pasien rujuk internal atau kontrol ulang.

#### Request

```json
{
  "metadata": {
    "method": "generate_sep_internal"
  },
  "data": {
    "nomor_kartu": "0001234567890",
    "tanggal_pelayanan": "2024-01-20",
    "poli_tujuan": "INT",
    "dpjp": "123456",
    "catatan": "Kontrol ulang pasca rawat inap",
    "jenis_pelayanan": "2",
    "kelas_rawat": "3",
    "rujukan_asal": {
      "nomor_rujukan": "",
      "ppk_rujukan": ""
    }
  }
}
```

#### Response Success

```json
{
  "metadata": {
    "code": "200",
    "message": "SEP Internal berhasil dibuat"
  },
  "response": {
    "sep": "0301R0011124010001",
    "nomor_kartu": "0001234567890",
    "nama_pasien": "JOHN DOE",
    "tanggal_sep": "2024-01-20",
    "poli": "Penyakit Dalam",
    "dpjp": "dr. Internist, Sp.PD",
    "jenis_pelayanan": "Rawat Jalan",
    "valid_until": "2024-01-20"
  }
}
```

---

### 12. send_suplesi - Kirim Data Suplesi

Untuk tambahan pembayaran seperti PICU, Kemoterapi, dll.

#### Request

```json
{
  "metadata": {
    "method": "send_suplesi"
  },
  "data": {
    "nomor_sep": "0301R0011123010001",
    "jenis_suplesi": "PICU",
    "jumlah_hari": 5,
    "tarif_suplesi": 2500000.0,
    "keterangan": "Perawatan PICU selama 5 hari"
  }
}
```

---

## Kode Referensi

### cara_masuk - Cara Masuk Pasien

| Kode | Deskripsi                         | Kapan Digunakan                                 |
| ---- | --------------------------------- | ----------------------------------------------- |
| `1`  | **IGD (Instalasi Gawat Darurat)** | Pasien masuk melalui IGD/UGD                    |
| `2`  | **Poliklinik/Rawat Jalan**        | Pasien masuk melalui pendaftaran poli           |
| `3`  | **Rujukan Langsung dari RS Lain** | Pasien dirujuk dari RS lain langsung rawat inap |
| `4`  | **Lahir di Rumah Sakit**          | Bayi baru lahir di RS ini (neonatus)            |

### jenis_rawat - Jenis Pelayanan

| Kode | Deskripsi       | LOS               | Contoh Kasus                    |
| ---- | --------------- | ----------------- | ------------------------------- |
| `1`  | **Rawat Inap**  | ≥ 1 hari          | Pasien menginap di RS           |
| `2`  | **Rawat Jalan** | 0 hari (same day) | Pasien pulang di hari yang sama |

### kelas_rawat - Kelas Perawatan

| Kode | Deskripsi   | Hak Peserta BPJS               | Catatan      |
| ---- | ----------- | ------------------------------ | ------------ |
| `1`  | **Kelas 1** | Mandiri Kelas 1, PBI upgrade   | Ruang 2 bed  |
| `2`  | **Kelas 2** | Mandiri Kelas 2                | Ruang 4 bed  |
| `3`  | **Kelas 3** | PBI/Jamkesmas, Mandiri Kelas 3 | Ruang >4 bed |

### discharge_status - Status Pulang

| Kode | Deskripsi                         | Dokumentasi Wajib             |
| ---- | --------------------------------- | ----------------------------- |
| `1`  | **Atas Persetujuan Dokter**       | Resume medis lengkap          |
| `2`  | **Pulang Paksa**                  | Surat pernyataan pulang paksa |
| `3`  | **Atas Permintaan Sendiri (APS)** | Surat pernyataan APS          |
| `4`  | **Meninggal**                     | Surat keterangan kematian     |
| `5`  | **Rujuk Keluar**                  | Surat rujukan ke RS lain      |

### icu_indikator - Indikator ICU

| Kode | Deskripsi                   | Field Wajib Jika "1"     |
| ---- | --------------------------- | ------------------------ |
| `0`  | **Tidak ada perawatan ICU** | -                        |
| `1`  | **Ada perawatan ICU**       | `icu_los`, `special_icu` |

### ventilator - Penggunaan Ventilator

| Kode | Deskripsi                        | Field Wajib Jika "1" |
| ---- | -------------------------------- | -------------------- |
| `0`  | **Tidak menggunakan ventilator** | -                    |
| `1`  | **Menggunakan ventilator**       | `ventilator_hour`    |

### upgrade_class_ind - Indikator Naik Kelas

| Kode | Deskripsi            | Field Wajib Jika "1"                       |
| ---- | -------------------- | ------------------------------------------ |
| `0`  | **Tidak naik kelas** | -                                          |
| `1`  | **Naik kelas**       | `upgrade_class_class`, `upgrade_class_los` |

### upgrade_class_class - Kelas yang Dinaiki

| Kode  | Deskripsi           | Dari Kelas          |
| ----- | ------------------- | ------------------- |
| `1`   | **Naik ke Kelas 1** | Dari Kelas 2 atau 3 |
| `2`   | **Naik ke Kelas 2** | Dari Kelas 3        |
| `vip` | **Naik ke VIP**     | Dari Kelas 1/2/3    |

### subacute - Status Subacute Care

| Kode | Deskripsi               | Field Wajib Jika "1"            |
| ---- | ----------------------- | ------------------------------- |
| `0`  | **Bukan subacute care** | -                               |
| `1`  | **Subacute care**       | `subacute_los`, `adl_sub_acute` |

### chronic - Status Chronic Care

| Kode | Deskripsi              | Field Wajib Jika "1"         |
| ---- | ---------------------- | ---------------------------- |
| `0`  | **Bukan chronic care** | -                            |
| `1`  | **Chronic care**       | `chronic_los`, `adl_chronic` |

### dialpirah - Hemodialisis

| Kode   | Deskripsi                                 |
| ------ | ----------------------------------------- |
| `0`    | **Tidak ada hemodialisis**                |
| `1-99` | **Jumlah sesi hemodialisis** selama rawat |

### terapi_konvalesen - Plasma Konvalesen

| Kode | Deskripsi                                |
| ---- | ---------------------------------------- |
| `0`  | **Tidak menggunakan plasma konvalesen**  |
| `1`  | **Menggunakan terapi plasma konvalesen** |

### special_icu - Tipe ICU Khusus

| Kode   | Deskripsi                              | Tarif Top-Up |
| ------ | -------------------------------------- | ------------ |
| `""`   | **Tidak ada**                          | -            |
| `IC`   | **ICU (Intensive Care Unit)**          | Ada          |
| `ICCU` | **ICCU (Intensive Cardiac Care Unit)** | Ada          |
| `PICU` | **PICU (Pediatric ICU)**               | Ada          |
| `NICU` | **NICU (Neonatal ICU)**                | Ada          |
| `BURN` | **Burn Unit (Luka Bakar)**             | Ada          |
| `ECMO` | **ECMO Support**                       | Ada          |

### icu_los Detail Fields

| Field          | Deskripsi                              |
| -------------- | -------------------------------------- |
| `icu_los`      | **Total hari perawatan ICU**           |
| `icu_los_ec`   | **Hari di ICU biasa (Emergency Care)** |
| `icu_los_eo`   | **Hari dengan Observasi khusus**       |
| `icu_los_etl`  | **Hari dengan Transplantasi**          |
| `icu_los_em`   | **Hari dengan Monitoring intensif**    |
| `icu_los_ecmo` | **Hari dengan ECMO**                   |

### add_payment_pct - Pembayaran Tambahan

| Kode    | Deskripsi                          |
| ------- | ---------------------------------- |
| `0`     | **Tidak ada pembayaran tambahan**  |
| `1-100` | **Persentase pembayaran tambahan** |

### birth_weight - Berat Lahir (gram)

| Range     | Kategori                        | Severity Biasa |
| --------- | ------------------------------- | -------------- |
| < 750     | **BBLSAR (Sangat Amat Rendah)** | Level III      |
| 750-999   | **BBLSR (Sangat Rendah)**       | Level III      |
| 1000-1499 | **BBLR Berat**                  | Level II       |
| 1500-1999 | **BBLR Sedang**                 | Level II       |
| 2000-2499 | **BBLR Ringan**                 | Level I        |
| 2500-4000 | **Normal**                      | Level 0-I      |
| > 4000    | **Makrosomia**                  | Level I        |

### Status Klaim

| Status        | Deskripsi             | Aksi Selanjutnya         |
| ------------- | --------------------- | ------------------------ |
| `CREATED`     | Klaim baru dibuat     | Lakukan Grouping         |
| `UPDATED`     | Klaim diupdate        | Lakukan Re-Grouping      |
| `GROUPED`     | Sudah di-grouping     | Finalisasi atau Edit     |
| `FINALIZED`   | Sudah dikirim ke BPJS | Tunggu verifikasi        |
| `CANCELLED`   | Finalisasi dibatalkan | Edit dan kirim ulang     |
| `REEDITED`    | Sudah di-reedit       | Grouping ulang           |
| `PENDING`     | Menunggu verifikasi   | Monitoring               |
| `LAYAK`       | Disetujui verifikator | Selesai, tunggu transfer |
| `TIDAK_LAYAK` | Ditolak verifikator   | Reedit atau dispute      |
| `DISPUTE`     | Dalam proses sengketa | Tunggu keputusan         |
| `DELETED`     | Klaim dihapus         | -                        |

### Severity Level (INA-CBG)

| Level | Deskripsi             | Multiplier Tarif           |
| ----- | --------------------- | -------------------------- |
| `0`   | **Rawat Jalan**       | Tarif paket tetap          |
| `I`   | **Ringan (Mild)**     | Tarif dasar (1.0x)         |
| `II`  | **Sedang (Moderate)** | Tarif + 20-40% (1.2-1.4x)  |
| `III` | **Berat (Severe)**    | Tarif + 50-100% (1.5-2.0x) |

---

## Integrasi dengan SIMRS

### Model Database Tambahan

```go
// EklaimClaim represents an E-Klaim submission
type EklaimClaim struct {
    ID              uint           `gorm:"primarykey" json:"id"`
    CreatedAt       time.Time      `json:"created_at"`
    UpdatedAt       time.Time      `json:"updated_at"`
    DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`

    // Reference to billing
    BillingID       uint     `gorm:"uniqueIndex" json:"billing_id"`
    Billing         *Billing `gorm:"foreignKey:BillingID" json:"billing,omitempty"`

    // SEP Data
    NomorSEP        string   `gorm:"size:50;uniqueIndex" json:"nomor_sep"`
    NomorKartu      string   `gorm:"size:20" json:"nomor_kartu"`

    // Claim Data
    TglMasuk        time.Time `json:"tgl_masuk"`
    TglPulang       time.Time `json:"tgl_pulang"`
    CaraMasuk       string    `gorm:"size:1" json:"cara_masuk"`
    JenisRawat      string    `gorm:"size:1" json:"jenis_rawat"`
    KelasRawat      string    `gorm:"size:1" json:"kelas_rawat"`
    DischargeStatus string    `gorm:"size:1" json:"discharge_status"`

    // Diagnosis & Procedures
    Diagnosa        string `gorm:"type:text" json:"diagnosa"`
    Procedure       string `gorm:"type:text" json:"procedure"`

    // Tariff
    TarifRS         float64 `gorm:"type:decimal(15,2)" json:"tarif_rs"`

    // INA-CBG Result
    CBGCode         string  `gorm:"size:20" json:"cbg_code"`
    CBGDescription  string  `gorm:"size:255" json:"cbg_description"`
    CBGTariff       float64 `gorm:"type:decimal(15,2)" json:"cbg_tariff"`

    // Status
    GrouperStatus   string `gorm:"size:20" json:"grouper_status"`   // PENDING, GROUPED, ERROR
    FinalStatus     string `gorm:"size:20" json:"final_status"`     // DRAFT, FINALIZED, CANCELLED
    VerifyStatus    string `gorm:"size:20" json:"verify_status"`    // PENDING, LAYAK, TIDAK_LAYAK

    // Timestamps
    GroupedAt       *time.Time `json:"grouped_at"`
    FinalizedAt     *time.Time `json:"finalized_at"`
    VerifiedAt      *time.Time `json:"verified_at"`

    // Metadata
    CoderNIK        string `gorm:"size:20" json:"coder_nik"`
    VerifiedBy      string `gorm:"size:100" json:"verified_by"`
    VerifyNotes     string `gorm:"type:text" json:"verify_notes"`
    ErrorMessage    string `gorm:"type:text" json:"error_message"`
}
```

### Mapping dari Visit ke E-Klaim

```go
// Dari visit/billing ke E-Klaim
func MapBillingToEklaim(billing *Billing, visit *Visit) *EklaimClaimRequest {
    // Get diagnoses from visit
    diagnoses := getDiagnosesForClaim(visit.ID)
    procedures := getProceduresForClaim(visit.ID)

    return &EklaimClaimRequest{
        NomorSEP:       billing.SEPNumber, // atau input manual
        NomorKartu:     billing.BPJSNumber,
        TglMasuk:       visit.CreatedAt.Format("2006-01-02"),
        TglPulang:      visit.CompletedAt.Format("2006-01-02"),
        CaraMasuk:      mapCaraMasuk(visit.ServiceType),
        JenisRawat:     mapJenisRawat(visit.ServiceType),
        KelasRawat:     billing.PatientClass,
        DischargeStatus: mapDischargeStatus(visit.DischargeType),
        Diagnosa:       formatDiagnoses(diagnoses),
        Procedure:      formatProcedures(procedures),
        TarifRS:        billing.FinalAmount,
        CoderNIK:       getCurrentUserNIK(),
    }
}
```

---

## Error Handling

### Error Codes

| Code | Message                    | Solusi                   |
| ---- | -------------------------- | ------------------------ |
| 200  | OK                         | Success                  |
| 201  | Created                    | Klaim berhasil dibuat    |
| 301  | Kode diagnosis tidak valid | Periksa kode ICD-10      |
| 302  | Kode prosedur tidak valid  | Periksa kode ICD-9-CM    |
| 303  | Data SEP tidak ditemukan   | Buat SEP terlebih dahulu |
| 304  | Klaim sudah difinalisasi   | Batalkan finalisasi dulu |
| 305  | Tanggal tidak valid        | Format: YYYY-MM-DD       |
| 401  | Unauthorized               | Periksa credentials      |
| 402  | Signature invalid          | Regenerate signature     |
| 500  | Internal server error      | Hubungi admin BPJS       |

---

## Kriteria iDRG

Berdasarkan file `DO 25 Kriteria Pengembangan Sistem IT Uji Coba iDRG.xlsx`:

### 25 Kriteria Utama

1. **Nomor SEP** - Wajib valid
2. **Tanggal Masuk & Pulang** - Format benar, LOS minimal 1 hari (RI)
3. **Diagnosis Utama** - ICD-10 valid, bukan kode Z/U
4. **Diagnosis Sekunder** - Maksimal 10, relevan dengan utama
5. **Prosedur** - ICD-9-CM valid jika ada tindakan
6. **Kelas Rawat** - Sesuai hak peserta
7. **Cara Masuk** - Kode valid (1-4)
8. **Discharge Status** - Kode valid (1-5)
9. **Tarif RS** - Harus > 0
10. **Berat Lahir** - Wajib untuk neonatus
11. **ICU Indicator** - Jika rawat ICU
12. **Ventilator Hours** - Jika menggunakan ventilator
13. **Upgrade Class** - Jika naik kelas
14. **ADL Score** - Untuk subacute/chronic
15. **NIK Coder** - Wajib 16 digit
16. **Konsistensi DxProc** - Diagnosis harus relevan dengan prosedur
17. **Severity Level** - Dihitung otomatis
18. **LOS Sesuai** - Tidak melebihi standar
19. **Special Case** - PICU, Kemo, Radioterapi
20. **Suplesi** - Data tambahan lengkap
21. **Duplikasi** - Tidak ada klaim duplikat
22. **Koneksi Rujukan** - Data rujukan valid
23. **Terapi Konvalesen** - Jika plasma konvalesen
24. **PAPI** - Jika pemberian antipatogenspesifik
25. **Kelengkapan Data** - Semua field wajib terisi

### Validasi Sebelum Grouping

```go
func ValidateClaimData(claim *EklaimClaimRequest) []ValidationError {
    var errors []ValidationError

    // 1. Validasi SEP
    if claim.NomorSEP == "" {
        errors = append(errors, ValidationError{
            Field: "nomor_sep",
            Message: "Nomor SEP wajib diisi",
        })
    }

    // 2. Validasi Tanggal
    if claim.TglMasuk > claim.TglPulang {
        errors = append(errors, ValidationError{
            Field: "tgl_pulang",
            Message: "Tanggal pulang tidak boleh sebelum tanggal masuk",
        })
    }

    // 3. Validasi Diagnosis Utama
    if !isValidICD10(claim.Diagnosa) {
        errors = append(errors, ValidationError{
            Field: "diagnosa",
            Message: "Kode diagnosis utama tidak valid",
        })
    }

    // 4. Validasi tidak boleh kode Z sebagai diagnosis utama
    if strings.HasPrefix(claim.Diagnosa, "Z") {
        errors = append(errors, ValidationError{
            Field: "diagnosa",
            Message: "Kode Z tidak boleh sebagai diagnosis utama",
        })
    }

    // 5. Validasi Tarif RS
    if claim.TarifRS <= 0 {
        errors = append(errors, ValidationError{
            Field: "tarif_rs",
            Message: "Tarif RS harus lebih dari 0",
        })
    }

    // 6. Validasi NIK Coder
    if len(claim.CoderNIK) != 16 {
        errors = append(errors, ValidationError{
            Field: "coder_nik",
            Message: "NIK Coder harus 16 digit",
        })
    }

    return errors
}
```

---

## Appendix: Data Dummy untuk Testing

### Contoh Request Lengkap Rawat Inap

```json
{
  "metadata": {
    "method": "new_claim"
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
    "diagnosa": "J18.9,E11.9,I10",
    "procedure": "93.94",
    "diagnosa_inagrouper": "J18.9,E11.9,I10",
    "procedure_inagrouper": "93.94",
    "tarif_rs": 5500000.0,
    "subacute": "0",
    "subacute_los": "0",
    "chronic": "0",
    "chronic_los": "0",
    "icu_los_ec": "0",
    "icu_los_eo": "0",
    "icu_los_etl": "0",
    "icu_los_em": "0",
    "icu_los_ecmo": "0",
    "terapi_konvalesen": "0",
    "papiname": "",
    "papivalue": "0",
    "special_icu": "",
    "coder_nik": "3374011234567890"
  }
}
```

### Contoh Request Rawat Jalan

```json
{
  "metadata": {
    "method": "new_claim"
  },
  "data": {
    "nomor_sep": "0301R0010124010002",
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
    "diagnosa": "E11.9",
    "procedure": "",
    "diagnosa_inagrouper": "E11.9",
    "procedure_inagrouper": "",
    "tarif_rs": 350000.0,
    "subacute": "0",
    "subacute_los": "0",
    "chronic": "0",
    "chronic_los": "0",
    "icu_los_ec": "0",
    "icu_los_eo": "0",
    "icu_los_etl": "0",
    "icu_los_em": "0",
    "icu_los_ecmo": "0",
    "terapi_konvalesen": "0",
    "papiname": "",
    "papivalue": "0",
    "special_icu": "",
    "coder_nik": "3374011234567890"
  }
}
```

---

## Referensi

- Manual Web Service E-Klaim 5.10.x.pdf
- DO 25 Kriteria Pengembangan Sistem IT Uji Coba iDRG.xlsx
- [BPJS Developer Portal](https://dvlp.bpjs-kesehatan.go.id)


## CONTOH FUNCTION UNTUK EKLAIM DALAM PHP
```
<?php
// Encryption Function
function inacbg_encrypt($data, $key)
  {
  /// make binary representation of $key
  $key = hex2bin($key);
  /// check key length, must be 256 bit or 32 bytes
  if (mb_strlen($key, "8bit") !== 32) {
  throw new Exception("Needs a 256-bit key!");
  }
  /// create initialization vector
  $iv_size = openssl_cipher_iv_length("aes-256-cbc");
  $iv = openssl_random_pseudo_bytes($iv_size); // dengan catatan dibawah
  /// encrypt
  $encrypted = openssl_encrypt(
  $data,
  "aes-256-cbc",
  $key,
  OPENSSL_RAW_DATA,
  $iv
  );
  /// create signature, against padding oracle attacks
  $signature = mb_substr(hash_hmac(
  "sha256",
  $encrypted,
  $key,
  true
  ), 0, 10, "8bit");
  /// combine all, encode, and format
  $encoded = chunk_split(base64_encode($signature . $iv . $encrypted));
  return $encoded;
}
```

```
function inacbg_decrypt($str, $strkey)
{
  /// make binary representation of $key
  $key = hex2bin($strkey);
  /// check key length, must be 256 bit or 32 bytes
  if (mb_strlen($key, "8bit") !== 32) {
  throw new Exception("Needs a 256-bit key!");
  }
  /// calculate iv size
  $iv_size = openssl_cipher_iv_length("aes-256-cbc");
  /// breakdown parts
  $decoded = base64_decode($str);
  $signature = mb_substr($decoded, 0, 10, "8bit");
  $iv = mb_substr($decoded, 10, $iv_size, "8bit");
  $encrypted = mb_substr($decoded, $iv_size + 10, NULL, "8bit");
  /// check signature, against padding oracle attack
  $calc_signature = mb_substr(hash_hmac(
  "sha256",
  $encrypted,
  $key,
  true
  ), 0, 10, "8bit");
  if (!inacbg_compare($signature, $calc_signature)) {
  return "SIGNATURE_NOT_MATCH"; /// signature doesn't match
  }
  $decrypted = openssl_decrypt(
  $encrypted,
  "aes-256-cbc",
  $key,
  OPENSSL_RAW_DATA,
  $iv
  );
  return $decrypted;
}
```

```
function inacbg_compare($a, $b)
{
 /// compare individually to prevent timing attacks
 /// compare length
 if (strlen($a) !== strlen($b))
 return false;
 /// compare individual
 $result = 0;
 for ($i = 0; $i < strlen($a); $i++) {
 $result |= ord($a[$i]) ^ ord($b[$i]);
 }
 return $result == 0;
}

```

## CONTOH PEMANGGILAN WEB SERVICE DENGAN PHP CURL

```
// contoh encryption key, bukan aktual
$key = "5cb7e8e7d0f6d15a9c986f4accc5022893938092039";
// json query
$json_request = <<<EOT
{
"metadata": {
"method": "claim_print"
},
"data": {
"nomor_sep": "16120507422"
}
}
EOT;
// membuat json juga dapat menggunakan json_encode:
$ws_query["metadata"]["method"] = "claim_print";
$ws_query["data"]["nomor_sep"] = "16120507422";
$json_request = json_encode($ws_query);
// data yang akan dikirimkan dengan method POST adalah encrypted: $payload =
inacbg_encrypt($json_request,$key);
// tentukan Content-Type pada http header
$header = array("Content-Type: application/x-www-form-urlencoded");
// url server aplikasi E-Klaim,
// silakan disesuaikan instalasi masing-masing
$url = "http://192.168.56.101/E-Klaim/ws.php";
// setup curl
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_HEADER, 0);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_HTTPHEADER, $header);
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
// request dengan curl
$response = curl_exec($ch);
// terlebih dahulu hilangkan "----BEGIN ENCRYPTED DATA----\r\n" // dan hilangkan "----END ENCRYPTED
DATA----\r\n" dari response $first = strpos($response, "\n")+1;
$last = strrpos($response, "\n") - 1;
$response = substr(
 $response,
 $first,
 strlen($response) - $first - $last
);
// decrypt dengan fungsi inacbg_decrypt
$response = inacbg_decrypt($response, $key);
// hasil decrypt adalah format json, di-translate ke dalam array $msg = json_decode($response,true);
// variable data adalah base64 dari file pdf
$pdf = base64_decode($msg["data"]);
// hasilnya adalah berupa binary string $pdf, untuk disimpan: file_put_contents("klaim.pdf",$pdf);
// atau untuk ditampilkan dengan perintah:
header("Content-type:application/pdf");
header("Content-Disposition:attachment;filename='klaim.pdf'");
echo $pdf;
```