# Script untuk konversi file SQL MySQL ke PostgreSQL
# Usage: .\convert-mysql-to-pgsql.ps1 -InputFile "LOINC.sql" -OutputFile "LOINC_pgsql.sql"

param(
    [Parameter(Mandatory=$true)]
    [string]$InputFile,
    
    [Parameter(Mandatory=$false)]
    [string]$OutputFile
)

if (-not $OutputFile) {
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($InputFile)
    $OutputFile = "${baseName}_pgsql.sql"
}

Write-Host "Converting MySQL to PostgreSQL..." -ForegroundColor Cyan
Write-Host "Input:  $InputFile"
Write-Host "Output: $OutputFile"

# Read file content
$content = Get-Content -Path $InputFile -Raw -Encoding UTF8

# ============================================================================
# 1. Remove MySQL-specific statements
# ============================================================================
Write-Host "1. Removing MySQL-specific statements..."

# Remove SET statements
$content = $content -replace '(?m)^SET\s+.*?;\s*$', ''

# Remove LOCK/UNLOCK TABLES
$content = $content -replace '(?m)^LOCK TABLES.*?;\s*$', ''
$content = $content -replace '(?m)^UNLOCK TABLES;\s*$', ''

# Remove MySQL comments like /*!40101 ... */
$content = $content -replace '/\*!\d+.*?\*/', ''

# Remove ENGINE, CHARSET, COLLATE clauses
$content = $content -replace '\s*ENGINE\s*=\s*\w+', ''
$content = $content -replace '\s*DEFAULT\s+CHARSET\s*=\s*\w+', ''
$content = $content -replace '\s*CHARSET\s*=\s*\w+', ''
$content = $content -replace '\s*COLLATE\s*=?\s*\w+', ''
$content = $content -replace '\s*AUTO_INCREMENT\s*=\s*\d+', ''
$content = $content -replace '\s*ROW_FORMAT\s*=\s*\w+', ''

# ============================================================================
# 2. Convert data types
# ============================================================================
Write-Host "2. Converting data types..."

# int(N) -> INTEGER
$content = $content -replace '\bint\(\d+\)', 'INTEGER'
$content = $content -replace '\bINT\(\d+\)', 'INTEGER'

# bigint(N) -> BIGINT  
$content = $content -replace '\bbigint\(\d+\)', 'BIGINT'
$content = $content -replace '\bBIGINT\(\d+\)', 'BIGINT'

# smallint(N) -> SMALLINT
$content = $content -replace '\bsmallint\(\d+\)', 'SMALLINT'
$content = $content -replace '\bSMALLINT\(\d+\)', 'SMALLINT'

# tinyint(1) -> BOOLEAN
$content = $content -replace '\btinyint\(1\)', 'BOOLEAN'
$content = $content -replace '\bTINYINT\(1\)', 'BOOLEAN'

# tinyint(N) -> SMALLINT
$content = $content -replace '\btinyint\(\d+\)', 'SMALLINT'
$content = $content -replace '\bTINYINT\(\d+\)', 'SMALLINT'

# mediumint -> INTEGER
$content = $content -replace '\bmediumint\(\d+\)', 'INTEGER'
$content = $content -replace '\bMEDIUMINT\(\d+\)', 'INTEGER'

# double -> DOUBLE PRECISION
$content = $content -replace '\bdouble\b', 'DOUBLE PRECISION'
$content = $content -replace '\bDOUBLE\b(?!\s+PRECISION)', 'DOUBLE PRECISION'

# float(N,M) -> REAL
$content = $content -replace '\bfloat\(\d+,\d+\)', 'REAL'
$content = $content -replace '\bFLOAT\(\d+,\d+\)', 'REAL'

# datetime -> TIMESTAMP
$content = $content -replace '\bdatetime\b', 'TIMESTAMP'
$content = $content -replace '\bDATETIME\b', 'TIMESTAMP'

# longtext/mediumtext/tinytext -> TEXT
$content = $content -replace '\blongtext\b', 'TEXT'
$content = $content -replace '\bLONGTEXT\b', 'TEXT'
$content = $content -replace '\bmediumtext\b', 'TEXT'
$content = $content -replace '\bMEDIUMTEXT\b', 'TEXT'
$content = $content -replace '\btinytext\b', 'TEXT'
$content = $content -replace '\bTINYTEXT\b', 'TEXT'

# longblob/mediumblob/tinyblob -> BYTEA
$content = $content -replace '\blongblob\b', 'BYTEA'
$content = $content -replace '\bLONGBLOB\b', 'BYTEA'
$content = $content -replace '\bmediumblob\b', 'BYTEA'
$content = $content -replace '\bMEDIUMBLOB\b', 'BYTEA'
$content = $content -replace '\btinyblob\b', 'BYTEA'
$content = $content -replace '\bTINYBLOB\b', 'BYTEA'
$content = $content -replace '\bblob\b', 'BYTEA'
$content = $content -replace '\bBLOB\b', 'BYTEA'

# enum -> VARCHAR (simplified)
$content = $content -replace "enum\([^)]+\)", 'VARCHAR(50)'
$content = $content -replace "ENUM\([^)]+\)", 'VARCHAR(50)'

# ============================================================================
# 3. Convert syntax
# ============================================================================
Write-Host "3. Converting syntax..."

# Backticks to double quotes for identifiers
$content = $content -replace '`', '"'

# AUTO_INCREMENT -> SERIAL (for CREATE TABLE)
$content = $content -replace '\bAUTO_INCREMENT\b', ''
$content = $content -replace 'INTEGER\s+NOT\s+NULL\s+PRIMARY\s+KEY', 'SERIAL PRIMARY KEY'
$content = $content -replace 'INTEGER\s+PRIMARY\s+KEY', 'SERIAL PRIMARY KEY'

# ON UPDATE CURRENT_TIMESTAMP -> remove (handled by trigger in PostgreSQL)
$content = $content -replace '\s*ON\s+UPDATE\s+CURRENT_TIMESTAMP', ''

# UNSIGNED -> remove (PostgreSQL doesn't have unsigned)
$content = $content -replace '\s+UNSIGNED\b', ''
$content = $content -replace '\s+unsigned\b', ''

# ZEROFILL -> remove
$content = $content -replace '\s+ZEROFILL\b', ''
$content = $content -replace '\s+zerofill\b', ''

# IF NOT EXISTS for CREATE TABLE (already supported in PostgreSQL)
# Keep as is

# ============================================================================
# 4. Convert string escaping
# ============================================================================
Write-Host "4. Converting string escaping..."

# \' -> '' (MySQL escape to PostgreSQL escape)
$content = $content -replace "\\\'", "''"

# \" -> " (remove escape for double quotes in strings)
$content = $content -replace '\\"', '"'

# \r\n -> actual newline or keep as is
# $content = $content -replace '\\r\\n', "`r`n"

# ============================================================================
# 5. Convert functions
# ============================================================================
Write-Host "5. Converting functions..."

# NOW() is same in both
# CURRENT_TIMESTAMP is same in both

# IFNULL -> COALESCE
$content = $content -replace '\bIFNULL\s*\(', 'COALESCE('
$content = $content -replace '\bifnull\s*\(', 'COALESCE('

# IF(condition, true_val, false_val) -> CASE WHEN condition THEN true_val ELSE false_val END
# This is complex, skip for now

# CONCAT with multiple args is same in both

# GROUP_CONCAT -> STRING_AGG
$content = $content -replace '\bGROUP_CONCAT\s*\(', 'STRING_AGG('
$content = $content -replace '\bgroup_concat\s*\(', 'STRING_AGG('

# LIMIT offset, count -> LIMIT count OFFSET offset
# This requires more complex parsing, skip for simple conversion

# ============================================================================
# 6. Handle INSERT statements
# ============================================================================
Write-Host "6. Processing INSERT statements..."

# INSERT IGNORE -> INSERT ... ON CONFLICT DO NOTHING (simplified)
$content = $content -replace 'INSERT\s+IGNORE\s+INTO', 'INSERT INTO'

# Add ON CONFLICT DO NOTHING for tables with unique constraints if needed
# This needs manual review

# ============================================================================
# 7. Clean up
# ============================================================================
Write-Host "7. Cleaning up..."

# Remove empty lines created by removed statements
$content = $content -replace '(?m)^\s*$\n', "`n"
$content = $content -replace '\n{3,}', "`n`n"

# Remove trailing commas before closing parenthesis in CREATE TABLE
$content = $content -replace ',\s*\)', ')'

# ============================================================================
# Save output
# ============================================================================
$content | Set-Content -Path $OutputFile -Encoding UTF8

Write-Host ""
Write-Host "Conversion completed!" -ForegroundColor Green
Write-Host "Output saved to: $OutputFile"
Write-Host ""
Write-Host "IMPORTANT: Please review the output file manually for:" -ForegroundColor Yellow
Write-Host "  1. Complex data type conversions (ENUM values)"
Write-Host "  2. AUTO_INCREMENT columns -> should be SERIAL"
Write-Host "  3. Index syntax differences"
Write-Host "  4. Stored procedures/functions (not converted)"
Write-Host "  5. LIMIT offset,count -> LIMIT count OFFSET offset"
Write-Host ""
Write-Host "To import into PostgreSQL:" -ForegroundColor Cyan
Write-Host "  psql -U username -d database_name -f $OutputFile"
