# backup_db.ps1
# mysqldump carmen_ai รายวัน เก็บ 14 รุ่น
# ตั้งค่าผ่าน environment variables หรือแก้ค่า default ด้านล่าง

param(
    [string]$DbHost     = "",
    [string]$DbPort     = "",
    [string]$DbUser     = "",
    [string]$DbPassword = "",
    [string]$DbName     = "",
    [string]$BackupRoot = "",
    [int]$KeepDays      = 14
)

if (-not $DbHost)     { $DbHost     = if ($env:DB_HOST)     { $env:DB_HOST }     else { "localhost" } }
if (-not $DbPort)     { $DbPort     = if ($env:DB_PORT)     { $env:DB_PORT }     else { "3306" } }
if (-not $DbUser)     { $DbUser     = if ($env:DB_USER)     { $env:DB_USER }     else { "root" } }
if (-not $DbPassword) { $DbPassword = if ($env:DB_PASSWORD) { $env:DB_PASSWORD } else { "" } }
if (-not $DbName)     { $DbName     = if ($env:DB_NAME)     { $env:DB_NAME }     else { "carmen_ai" } }
if (-not $BackupRoot) { $BackupRoot = if ($env:BACKUP_DIR)  { $env:BACKUP_DIR }  else { "C:\backups\carmen_ai" } }

$mysqldump = "C:\Program Files\MariaDB 10.5\bin\mysqldump.exe"

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ---------------------------------------------------------------------------
# 1. เตรียม directory
# ---------------------------------------------------------------------------
if (-not (Test-Path $BackupRoot)) {
    New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null
}

# ---------------------------------------------------------------------------
# 2. ตั้งชื่อไฟล์ตามวันที่
# ---------------------------------------------------------------------------
$timestamp  = Get-Date -Format "yyyy-MM-dd_HH-mm"
$dumpFile   = Join-Path $BackupRoot "carmen_ai_$timestamp.sql"
$gzipFile   = "$dumpFile.gz"

# ---------------------------------------------------------------------------
# 3. รัน mysqldump
# ---------------------------------------------------------------------------
Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Starting backup → $dumpFile"

$env:MYSQL_PWD = $DbPassword   # ส่ง password โดยไม่ผ่าน command line (ป้องกัน process list leak)

$mysqldumpArgs = @(
    "--host=$DbHost",
    "--port=$DbPort",
    "--user=$DbUser",
    "--single-transaction",     # consistent snapshot โดยไม่ lock ตาราง
    "--routines",
    "--triggers",
    "--hex-blob",
    "--result-file=$dumpFile",
    $DbName
)

& $mysqldump @mysqldumpArgs

if ($LASTEXITCODE -ne 0) {
    Write-Error "mysqldump failed with exit code $LASTEXITCODE"
    exit 1
}

# ---------------------------------------------------------------------------
# 4. Compress ด้วย Compress-Archive (.zip)
# ---------------------------------------------------------------------------
Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Compressing..."

$zipFile = "$dumpFile.zip"
Compress-Archive -Path $dumpFile -DestinationPath $zipFile -Force
Remove-Item $dumpFile -Force

$sizeMB = [math]::Round((Get-Item $zipFile).Length / 1MB, 2)
Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Backup complete: $zipFile ($sizeMB MB)"

# ---------------------------------------------------------------------------
# 5. ลบ backup เก่าเกิน $KeepDays วัน
# ---------------------------------------------------------------------------
$cutoff = (Get-Date).AddDays(-$KeepDays)
$old = @(Get-ChildItem -Path $BackupRoot -File | Where-Object { $_.LastWriteTime -lt $cutoff })

if ($old.Count -gt 0) {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Removing $($old.Count) old backup(s)..."
    $old | Remove-Item -Force
}

# ---------------------------------------------------------------------------
# 6. แสดงสรุป
# ---------------------------------------------------------------------------
$allBackups = @(Get-ChildItem -Path $BackupRoot -File | Sort-Object LastWriteTime)
Write-Host ""
Write-Host "Backups in $BackupRoot ($($allBackups.Count) files):"
$allBackups | ForEach-Object {
    Write-Host "  $($_.Name)  [$([math]::Round($_.Length/1MB,2)) MB]"
}
