# Daily MariaDB backup for Windows Server / IIS
# Setup: Task Scheduler → run daily at 02:00
#   Action: powershell.exe -File "C:\path\to\backup_db.ps1"

param(
    [string]$DbHost      = $env:DB_HOST      ?? "localhost",
    [string]$DbPort      = $env:DB_PORT      ?? "3306",
    [string]$DbUser      = $env:DB_USER      ?? "root",
    [string]$DbPass      = $env:DB_PASS      ?? "",
    [string]$DbName      = $env:DB_NAME      ?? "carmen_ai",
    [string]$BackupDir   = $env:BACKUP_DIR   ?? "C:\Backups\carmen_ai",
    [int]   $KeepDays    = $env:KEEP_DAYS    ?? 30,
    [string]$MysqlDump   = $env:MYSQLDUMP    ?? "mysqldump"   # full path if not in PATH
)

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$file      = Join-Path $BackupDir "${DbName}_${timestamp}.sql"

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

Write-Host "[$(Get-Date)] Starting backup → $file"

# Build mysqldump args
$args = @("-h", $DbHost, "-P", $DbPort, "-u", $DbUser)
if ($DbPass) { $args += "--password=$DbPass" }
$args += @("--single-transaction", "--routines", "--triggers", $DbName)

& $MysqlDump @args | Out-File -FilePath $file -Encoding utf8

if ($LASTEXITCODE -ne 0) {
    Write-Error "[$(Get-Date)] mysqldump failed (exit $LASTEXITCODE)"
    exit 1
}

# Compress
Compress-Archive -Path $file -DestinationPath "$file.zip" -Force
Remove-Item $file

$size = (Get-Item "$file.zip").Length / 1MB
Write-Host "[$(Get-Date)] Backup complete: $([math]::Round($size, 2)) MB"

# Remove backups older than KeepDays
Get-ChildItem -Path $BackupDir -Filter "${DbName}_*.sql.zip" |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDays) } |
    Remove-Item

Write-Host "[$(Get-Date)] Cleaned backups older than $KeepDays days"
