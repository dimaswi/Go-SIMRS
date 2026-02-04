# Panduan Import Data LOINC & SNOMED CT dari Kemkes IHS

## Overview

Sistem SIMRS ini menggunakan **PostgreSQL** sebagai database dan struktur data terminologi sesuai dengan format **Kemkes IHS (Indonesia Health Services)**. 

Data LOINC harus diimport dari file SQL yang disediakan oleh Kemkes. File SQL Kemkes biasanya dalam format MySQL, sehingga perlu dikonversi ke PostgreSQL.

## Struktur Tabel

### 1. LOINC Master (`loinc_terminologi`)

Tabel ini menyimpan data LOINC sesuai format Kemkes (~3800+ rows).

```sql
-- PostgreSQL
CREATE TABLE loinc_terminologi (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  
  -- Informasi Kemkes (Bahasa Indonesia)
  kategori_pemeriksaan VARCHAR(100),    -- "Hematologi", "Mikrobiologi", "Radiologi"
  nama_pemeriksaan VARCHAR(500),        -- Nama dalam Bahasa Indonesia
  permintaan_hasil VARCHAR(50),         -- "Permintaan", "Hasil", "Permintaan & Hasil"
  spesimen VARCHAR(100),                -- "Darah", "Serum/Plasma", "Urin"
  tipe_hasil_pemeriksaan VARCHAR(50),   -- "Nominal", "Ordinal", "Quantitative", "Narrative"
  satuan VARCHAR(50),                   -- "mg/dL", "%", "detik"
  metode_analisis VARCHAR(200),
  
  -- LOINC Standard Fields
  loinc_code VARCHAR(20),               -- "2339-0", "X099080"
  display VARCHAR(500),                 -- English display name
  component VARCHAR(500),
  property VARCHAR(50),                 -- "MCnc", "PrThr"
  timing VARCHAR(20),                   -- "Pt" = Point in time
  system VARCHAR(100),                  -- "Bld", "Ser/Plas"
  scale VARCHAR(20),                    -- "Qn", "Ord", "Nom"
  method VARCHAR(200),
  unit_of_measure VARCHAR(50),
  code_system VARCHAR(200),             -- "http://loinc.org" or Kemkes extension
  
  -- Body Site (untuk Radiologi)
  body_site_code VARCHAR(20),
  body_site_display VARCHAR(200),
  body_site_code_system VARCHAR(200),
  
  -- Version tracking
  version_first_released VARCHAR(20),
  version_last_changed VARCHAR(20),
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE
);

-- Create indexes
CREATE INDEX idx_loinc_code ON loinc_terminologi(loinc_code);
CREATE INDEX idx_loinc_kategori ON loinc_terminologi(kategori_pemeriksaan);
CREATE INDEX idx_loinc_nama ON loinc_terminologi(nama_pemeriksaan);
CREATE INDEX idx_loinc_spesimen ON loinc_terminologi(spesimen);
CREATE INDEX idx_loinc_is_active ON loinc_terminologi(is_active);
```

### 2. SNOMED CT Master (`snomed_masters`)

Tabel ini menyimpan data SNOMED CT. **Data essential sudah di-seed otomatis oleh aplikasi** (kategori prosedur, spesimen, body site). Jika Anda memiliki dataset SNOMED lengkap (1 juta+ rows), dapat diimport terpisah.

```sql
-- PostgreSQL
CREATE TABLE snomed_masters (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  
  snomed_code VARCHAR(20) NOT NULL UNIQUE,  -- "108252007"
  display VARCHAR(500) NOT NULL,             -- English display
  display_id VARCHAR(500),                   -- Indonesian display (optional)
  category VARCHAR(50),                      -- "procedure", "specimen", "bodysite", "finding", "disorder"
  parent_code VARCHAR(20),                   -- For hierarchy
  semantic_tag VARCHAR(100),                 -- "(specimen)", "(body structure)"
  is_active BOOLEAN DEFAULT TRUE
);

-- Create indexes
CREATE INDEX idx_snomed_code ON snomed_masters(snomed_code);
CREATE INDEX idx_snomed_category ON snomed_masters(category);
CREATE INDEX idx_snomed_display ON snomed_masters(display);
CREATE INDEX idx_snomed_is_active ON snomed_masters(is_active);
```

## Konversi MySQL ke PostgreSQL

File SQL Kemkes biasanya dalam format MySQL. Berikut cara konversi:

### Script Konversi Otomatis (PowerShell)

```powershell
# Konversi LOINC.sql dari MySQL ke PostgreSQL
$content = Get-Content -Path "LOINC.sql" -Raw

# Replace MySQL-specific syntax
$content = $content -replace '`', '"'                          # Backticks to quotes
$content = $content -replace 'AUTO_INCREMENT', ''              # Remove AUTO_INCREMENT
$content = $content -replace 'ENGINE=InnoDB.*?;', ';'          # Remove ENGINE clause
$content = $content -replace 'DEFAULT CHARSET=.*?;', ';'       # Remove CHARSET
$content = $content -replace 'int\(\d+\)', 'INTEGER'           # int(11) to INTEGER
$content = $content -replace 'tinyint\(\d+\)', 'SMALLINT'      # tinyint to SMALLINT
$content = $content -replace 'datetime', 'TIMESTAMP'           # datetime to TIMESTAMP
$content = $content -replace "\\\'", "''"                      # Escape quotes
$content = $content -replace 'ON UPDATE CURRENT_TIMESTAMP', '' # Remove ON UPDATE

# Save converted file
$content | Set-Content -Path "LOINC_postgres.sql"
```

### Script Konversi (Bash/Linux)

```bash
#!/bin/bash
# Konversi LOINC.sql dari MySQL ke PostgreSQL

sed -e "s/\`/\"/g" \
    -e "s/AUTO_INCREMENT//g" \
    -e "s/ENGINE=InnoDB[^;]*//g" \
    -e "s/DEFAULT CHARSET=[^;]*//g" \
    -e "s/int([0-9]*)/INTEGER/g" \
    -e "s/tinyint([0-9]*)/SMALLINT/g" \
    -e "s/datetime/TIMESTAMP/g" \
    -e "s/\\\\'/\\'\\'/g" \
    LOINC.sql > LOINC_postgres.sql
```

### Manual Conversion Tips

1. **Backticks ke Double Quotes**: MySQL pakai \`column\`, PostgreSQL pakai "column"
2. **AUTO_INCREMENT**: Hapus, gunakan SERIAL di PostgreSQL
3. **ENGINE clause**: Hapus `ENGINE=InnoDB`
4. **CHARSET**: Hapus `DEFAULT CHARSET=utf8mb4`
5. **Escape quotes**: `\'` di MySQL jadi `''` di PostgreSQL
6. **Data types**:
   - `int(11)` → `INTEGER`
   - `tinyint(1)` → `BOOLEAN` atau `SMALLINT`
   - `datetime` → `TIMESTAMP`

## Cara Import Data

### Import LOINC ke PostgreSQL

1. **Konversi SQL file** (jika dari MySQL)
2. **Import ke database**:

```bash
# Via psql
psql -U username -d database_name -f LOINC_postgres.sql

# Atau dengan password
PGPASSWORD=yourpassword psql -U username -d database_name -f LOINC_postgres.sql
```

Atau via pgAdmin:
1. Buka pgAdmin
2. Pilih database → Tools → Query Tool
3. Load dan execute SQL file

### Import SNOMED CT (Dataset Besar - Opsional)

⚠️ **PENTING**: 
- Data SNOMED essential (procedure, specimen, bodysite) sudah di-seed otomatis oleh aplikasi
- Import dataset lengkap (1M+ rows) hanya jika diperlukan

**Untuk import besar, gunakan COPY command (lebih cepat):**

```sql
-- Siapkan CSV terlebih dahulu
COPY snomed_masters(snomed_code, display, display_id, category, semantic_tag, is_active)
FROM '/path/to/snomed.csv'
DELIMITER ','
CSV HEADER;
```

**Atau gunakan pg_bulkload untuk dataset sangat besar:**

```bash
pg_bulkload -d database_name -i snomed.csv -O snomed_masters
```

### Verifikasi Import

```sql
-- Hitung total LOINC
SELECT COUNT(*) as total_loinc FROM loinc_terminologi WHERE is_active = true;
-- Expected: ~3800+

-- Hitung SNOMED per kategori
SELECT category, COUNT(*) as count 
FROM snomed_masters 
WHERE is_active = true 
GROUP BY category
ORDER BY count DESC;

-- Check LOINC categories (kategori pemeriksaan)
SELECT kategori_pemeriksaan, COUNT(*) as count 
FROM loinc_terminologi 
WHERE is_active = true 
GROUP BY kategori_pemeriksaan
ORDER BY count DESC;

-- Lihat sample data LOINC
SELECT loinc_code, nama_pemeriksaan, kategori_pemeriksaan, spesimen
FROM loinc_terminologi
WHERE is_active = true
LIMIT 10;
```

## Data yang Sudah Tersedia (Auto-Seed)

Aplikasi akan otomatis men-seed data SNOMED essential saat startup:

### Procedure Categories
| Code | Display | Display ID |
|------|---------|------------|
| 108252007 | Laboratory procedure | Prosedur Laboratorium |
| 363679005 | Imaging | Pencitraan Medis |
| 387713003 | Surgical procedure | Prosedur Bedah |
| 409063005 | Counseling | Konseling |
| 409073007 | Education | Edukasi |
| 386053000 | Evaluation procedure | Prosedur Evaluasi |
| 91251008 | Physical therapy procedure | Fisioterapi |

### Specimen Types (20+ jenis)
- Blood, Serum, Plasma, Urine, Stool, dll.

### Body Sites (50+ lokasi)
- Head, Thorax, Abdomen, Spine, Limbs, dll.

## API Endpoints

```
GET /api/loinc/master                    - List LOINC dengan filter & pagination
GET /api/loinc/master/search?q=xxx       - Search LOINC untuk autocomplete
GET /api/loinc/master/lookup/:code       - Lookup LOINC by exact code
GET /api/loinc/master/kategori           - Get distinct kategori list
GET /api/loinc/master/spesimen           - Get distinct spesimen list

GET /api/loinc/snomed                    - List SNOMED dengan filter & pagination
GET /api/loinc/snomed/search?q=xxx       - Search SNOMED untuk autocomplete
GET /api/loinc/snomed/lookup/:code       - Lookup SNOMED by exact code
GET /api/loinc/snomed/category/:cat      - Get SNOMED by category
GET /api/loinc/snomed/categories         - Get distinct category list
```

## Catatan Performa

- **LOINC**: ~3800 rows, aman untuk autocomplete dan dropdown
- **SNOMED Essential**: ~100 rows, di-seed otomatis
- **SNOMED Full** (jika diimport): 1M+ rows
  - HARUS gunakan server-side search
  - Jangan pernah load semua data ke dropdown
  - Minimum 2 karakter untuk search
  - Limit hasil max 30-50 items

## Referensi

- [Kemkes IHS Portal](https://ihs.kemkes.go.id/)
- [SatuSehat FHIR Documentation](https://satusehat.kemkes.go.id/)
- [LOINC Official](https://loinc.org/)
- [SNOMED International](https://www.snomed.org/)
- [PostgreSQL COPY Documentation](https://www.postgresql.org/docs/current/sql-copy.html)
