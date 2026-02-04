# Script khusus untuk konversi file LOINC/SNOMED Kemkes (INSERT only) ke PostgreSQL
# Usage: .\convert-kemkes-sql.ps1 -InputFile "LOINC.sql" -TableName "loinc"

param(
    [Parameter(Mandatory=$true)]
    [string]$InputFile,
    
    [Parameter(Mandatory=$false)]
    [string]$TableName = "loinc",
    
    [Parameter(Mandatory=$false)]
    [string]$OutputFile
)

if (-not $OutputFile) {
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($InputFile)
    $OutputFile = "${baseName}_pgsql.sql"
}

Write-Host "Converting Kemkes SQL to PostgreSQL..." -ForegroundColor Cyan
Write-Host "Input:  $InputFile"
Write-Host "Output: $OutputFile"
Write-Host "Target Table: $TableName"

# Read file content
$content = Get-Content -Path $InputFile -Raw -Encoding UTF8

# ============================================================================
# 1. Remove MySQL-specific statements and comments
# ============================================================================
Write-Host "1. Removing MySQL-specific statements..."

# Remove SET statements
$content = $content -replace '(?m)^SET\s+.*?;\s*$', ''

# Remove LOCK/UNLOCK TABLES
$content = $content -replace '(?m)^LOCK TABLES.*?;\s*$', ''
$content = $content -replace '(?m)^UNLOCK TABLES;\s*$', ''

# Remove MySQL comments like /*!40101 ... */
$content = $content -replace '/\*!\d+.*?\*/', ''

# Remove -- comments at start of lines (keep data)
$content = $content -replace '(?m)^--.*$', ''

# ============================================================================
# 2. Fix table name (loinc_terminologi -> loinc)
# ============================================================================
Write-Host "2. Fixing table name..."

# Change table name from loinc_terminologi to target table
$content = $content -replace '"loinc_terminologi"', "`"$TableName`""
$content = $content -replace '`loinc_terminologi`', "`"$TableName`""
$content = $content -replace 'loinc_terminologi', "$TableName"

# ============================================================================
# 3. Fix column names to match our model
# ============================================================================
Write-Host "3. Fixing column names..."

# Mapping kolom dari Kemkes ke model kita:
# "body_site_code_sistem" -> "body_site_code_system"
# CATATAN: kolom "code" tetap "code" (tidak perlu diubah)

# Fix column name in INSERT statement
$content = $content -replace '"body_site_code_sistem"', '"body_site_code_system"'
$content = $content -replace '`body_site_code_sistem`', '"body_site_code_system"'

# ============================================================================
# 4. Convert backticks to double quotes
# ============================================================================
Write-Host "4. Converting identifiers..."

$content = $content -replace '`', '"'

# ============================================================================
# 5. Fix string escaping
# ============================================================================
Write-Host "5. Fixing string escaping..."

# \' -> '' (MySQL escape to PostgreSQL escape)
$content = $content -replace "\\\'", "''"

# \" -> " 
$content = $content -replace '\\"', '"'

# ============================================================================
# 6. Clean up empty lines
# ============================================================================
Write-Host "6. Cleaning up..."

$content = $content -replace '(?m)^\s*$\n', "`n"
$content = $content -replace '\n{3,}', "`n`n"

# Remove semicolons on empty lines
$content = $content -replace '(?m)^;\s*$', ''

# ============================================================================
# 7. Add header comment
# ============================================================================
$header = @"
-- ============================================================================
-- LOINC Data untuk PostgreSQL
-- Converted from Kemkes IHS MySQL format
-- Target table: $TableName
-- ============================================================================

-- PENTING: Pastikan tabel sudah dibuat oleh GORM migration sebelum import
-- Jalankan backend terlebih dahulu agar tabel terbentuk

-- Truncate existing data (optional - uncomment if needed)
-- TRUNCATE TABLE $TableName RESTART IDENTITY;


"@

$content = $header + $content

# ============================================================================
# Save output
# ============================================================================
$content | Set-Content -Path $OutputFile -Encoding UTF8

Write-Host ""
Write-Host "Conversion completed!" -ForegroundColor Green
Write-Host "Output saved to: $OutputFile"
Write-Host ""
Write-Host "Kolom yang diubah:" -ForegroundColor Yellow
Write-Host "  - 'body_site_code_sistem' -> 'body_site_code_system'"
Write-Host "  - Table: loinc_terminologi -> $TableName"
Write-Host ""
Write-Host "Langkah selanjutnya:" -ForegroundColor Cyan
Write-Host "  1. Jalankan backend terlebih dahulu agar tabel terbentuk"
Write-Host "  2. Import ke PostgreSQL:"
Write-Host "     psql -U postgres -d simrs -f $OutputFile"
Write-Host ""
Write-Host "  Atau via Docker:"
Write-Host "     docker exec -i <container> psql -U postgres -d simrs -f - < $OutputFile"
