# Import SNOMED CT data ke PostgreSQL via Docker
# File: DATA SNOMED CT.sql (162 MB)

Write-Host "========================================"
Write-Host "IMPORT SNOMED CT KE POSTGRESQL"
Write-Host "========================================"
Write-Host ""

# Konfigurasi
$containerName = "starter-postgres-dev"
$dbUser = "starter"
$dbName = "starter"
$sqlFile = "E:\Golang\Go-SIMRS\DATA SNOMED CT.sql"

# Cek apakah container running
$containerRunning = docker ps --filter "name=$containerName" --format "{{.Names}}"
if (-not $containerRunning) {
    Write-Host "ERROR: Container '$containerName' tidak running!" -ForegroundColor Red
    Write-Host "Jalankan: docker-compose -f docker-compose.dev.yml up -d"
    exit 1
}

Write-Host "Container: $containerName [RUNNING]" -ForegroundColor Green
Write-Host "Database: $dbName"
Write-Host "File: $sqlFile"
Write-Host ""

# Cek file exists
if (-not (Test-Path $sqlFile)) {
    Write-Host "ERROR: File tidak ditemukan: $sqlFile" -ForegroundColor Red
    exit 1
}

$fileSize = [math]::Round((Get-Item $sqlFile).Length / 1MB, 2)
Write-Host "Ukuran file: $fileSize MB" -ForegroundColor Yellow
Write-Host ""

# Step 1: Buat tabel snomed_ct jika belum ada
Write-Host "Step 1: Membuat tabel snomed_ct..."
$createTableSQL = @"
CREATE TABLE IF NOT EXISTS snomed_ct (
    id SERIAL PRIMARY KEY,
    "effectiveTime" INTEGER,
    active INTEGER DEFAULT 0,
    "moduleId" VARCHAR(50),
    "conceptId" VARCHAR(50),
    "languageCode" VARCHAR(50),
    "typeId" VARCHAR(50),
    term VARCHAR(300),
    "caseSignificanceId" VARCHAR(50)
);

-- Index untuk pencarian cepat
CREATE INDEX IF NOT EXISTS idx_snomed_ct_conceptId ON snomed_ct ("conceptId");
CREATE INDEX IF NOT EXISTS idx_snomed_ct_term ON snomed_ct USING gin (to_tsvector('english', term));
CREATE INDEX IF NOT EXISTS idx_snomed_ct_active ON snomed_ct (active);
"@

$createTableSQL | docker exec -i $containerName psql -U $dbUser -d $dbName
Write-Host "Tabel snomed_ct siap!" -ForegroundColor Green
Write-Host ""

# Step 2: Truncate data lama (opsional)
Write-Host "Step 2: Hapus data lama (jika ada)..."
$confirm = Read-Host "Hapus data SNOMED CT lama? (y/n)"
if ($confirm -eq 'y') {
    "TRUNCATE TABLE snomed_ct RESTART IDENTITY;" | docker exec -i $containerName psql -U $dbUser -d $dbName
    Write-Host "Data lama dihapus!" -ForegroundColor Yellow
}
Write-Host ""

# Step 3: Import data
Write-Host "Step 3: Importing data SNOMED CT..." -ForegroundColor Cyan
Write-Host "Ini akan memakan waktu beberapa menit untuk file $fileSize MB"
Write-Host ""

$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

# Import menggunakan piping (tanpa membuka file di memory)
Get-Content $sqlFile -ReadCount 0 | docker exec -i $containerName psql -U $dbUser -d $dbName

$stopwatch.Stop()
$elapsed = $stopwatch.Elapsed

Write-Host ""
Write-Host "========================================"
Write-Host "IMPORT SELESAI!" -ForegroundColor Green
Write-Host "Waktu: $($elapsed.Minutes) menit $($elapsed.Seconds) detik"
Write-Host "========================================"

# Step 4: Verifikasi
Write-Host ""
Write-Host "Step 4: Verifikasi data..."
"SELECT COUNT(*) as total_rows FROM snomed_ct;" | docker exec -i $containerName psql -U $dbUser -d $dbName
"SELECT * FROM snomed_ct LIMIT 5;" | docker exec -i $containerName psql -U $dbUser -d $dbName

Write-Host ""
Write-Host "Done! Data SNOMED CT berhasil diimport." -ForegroundColor Green
