# Daily MariaDB backup for Windows Server / IIS
# Setup: Task Scheduler → run daily at 02:00
#   Action: powershell.exe -File "C:\path\to\backup_db.ps1"

param(
    [string]$DbHost      = "localhost",
    [string]$DbPort      = "3306",
    [string]$DbUser      = "root",
    [string]$DbPass      = "",
    [string]$DbName      = "carmen_ai",
    [string]$BackupDir   = "C:\Backups\carmen_ai",
    [int]   $KeepDays    = 30,
    [string]$MysqlDump   = "mysqldump"   # full path if not in PATH
)

if ($env:DB_HOST)      { $DbHost      = $env:DB_HOST }
if ($env:DB_PORT)      { $DbPort      = $env:DB_PORT }
if ($env:DB_USER)      { $DbUser      = $env:DB_USER }
if ($env:DB_PASS)      { $DbPass      = $env:DB_PASS }
if ($env:DB_NAME)      { $DbName      = $env:DB_NAME }
if ($env:BACKUP_DIR)   { $BackupDir   = $env:BACKUP_DIR }
if ($env:KEEP_DAYS)    { $KeepDays    = [int]$env:KEEP_DAYS }
if ($env:MYSQLDUMP)    { $MysqlDump   = $env:MYSQLDUMP }

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$file      = Join-Path $BackupDir "${DbName}_${timestamp}.sql"

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

Write-Host "[$(Get-Date)] Starting backup → $file"

# Build mysqldump args
$dumpArgs = @("-h", $DbHost, "-P", $DbPort, "-u", $DbUser)
if ($DbPass) { $dumpArgs += "--password=$DbPass" }
$dumpArgs += @("--single-transaction", "--routines", "--triggers", $DbName)

& $MysqlDump @dumpArgs | Out-File -FilePath $file -Encoding utf8

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
