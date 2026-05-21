<#
.SYNOPSIS
    Build frontend + backend and copy to deploy path, ready for IIS.

.EXAMPLE
    .\deploy.ps1
    .\deploy.ps1 -DeployPath "D:\Sites\carmen_ai" -BackendPort 8010

.NOTES
    Requirements:
      - Node.js (npm)
      - Python 3.12
      - IIS with HttpPlatformHandler module
      - IIS URL Rewrite module (for frontend SPA + API proxy)
#>

param(
    [string] $DeployPath  = "C:\inetpub\carmen_ai",
    [int]    $BackendPort = 8010,
    [string] $ProjectRoot = $PSScriptRoot
)

$ErrorActionPreference = "Stop"

$FrontendSrc  = Join-Path $ProjectRoot "frontend"
$BackendSrc   = Join-Path $ProjectRoot "backend"
$FrontendDest = Join-Path $DeployPath  "frontend"
$BackendDest  = Join-Path $DeployPath  "backend"

function Write-Step([string]$msg) {
    Write-Host ""
    Write-Host ">> $msg" -ForegroundColor Cyan
}
function Write-OK([string]$msg) {
    Write-Host "   OK: $msg" -ForegroundColor Green
}
function Write-Warn([string]$msg) {
    Write-Host "   WARN: $msg" -ForegroundColor Yellow
}

Write-Host "==========================================="
Write-Host "  Carmen AI -- Deploy Script"
Write-Host "  Deploy Path : $DeployPath"
Write-Host "  Backend Port: $BackendPort"
Write-Host "==========================================="


# ── 1. Build Frontend ────────────────────────────────────────────────────────
Write-Step "Building frontend (npm run build)..."

Push-Location $FrontendSrc
try {
    npm ci --legacy-peer-deps --silent
    npm run build
} finally {
    Pop-Location
}

Write-OK "Frontend built -> dist/"


# ── 2. Copy Frontend dist → deploy/frontend ──────────────────────────────────
Write-Step "Copying frontend to $FrontendDest..."

if (Test-Path $FrontendDest) { Remove-Item $FrontendDest -Recurse -Force }
Copy-Item (Join-Path $FrontendSrc "dist") $FrontendDest -Recurse

$frontendWebConfig = Join-Path $FrontendDest "web.config"
$apiProxyUrl = "http://localhost:$BackendPort/api/{R:1}"

Set-Content -Path $frontendWebConfig -Encoding UTF8 -Value @"
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="API Proxy" stopProcessing="true">
          <match url="^api/(.*)" />
          <action type="Rewrite" url="$apiProxyUrl" />
        </rule>
        <rule name="SPA Fallback" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
          </conditions>
          <action type="Rewrite" url="/index.html" />
        </rule>
      </rules>
    </rewrite>
    <staticContent>
      <mimeMap fileExtension=".webp" mimeType="image/webp" />
      <mimeMap fileExtension=".woff2" mimeType="font/woff2" />
    </staticContent>
  </system.webServer>
</configuration>
"@

Write-OK "Frontend copied + web.config generated"


# ── 3. Copy Backend source → deploy/backend ──────────────────────────────────
Write-Step "Copying backend source to $BackendDest..."

New-Item -ItemType Directory -Force -Path $BackendDest | Out-Null

$appDest = Join-Path $BackendDest "app"
if (Test-Path $appDest) { Remove-Item $appDest -Recurse -Force }
Copy-Item (Join-Path $BackendSrc "app") $appDest -Recurse

Copy-Item (Join-Path $BackendSrc "requirements.txt") $BackendDest

$envSrc  = Join-Path $BackendSrc ".env"
$envDest = Join-Path $BackendDest ".env"
if (Test-Path $envSrc) {
    Copy-Item $envSrc $envDest
    Write-OK ".env copied"
} else {
    Write-Warn ".env not found -- create it manually at: $envDest"
}

Write-OK "Backend source copied"


# ── 4. Create / update venv ───────────────────────────────────────────────────
Write-Step "Setting up Python venv..."

$venvPath = Join-Path $BackendDest "venv"
if (-not (Test-Path $venvPath)) {
    python -m venv $venvPath
    Write-OK "venv created"
} else {
    Write-OK "venv already exists -- skipping creation"
}

$pip  = Join-Path $venvPath "Scripts\pip.exe"
$reqs = Join-Path $BackendDest "requirements.txt"
& $pip install --quiet -r $reqs
Write-OK "Dependencies installed"


# ── 5. Generate backend web.config ───────────────────────────────────────────
Write-Step "Generating backend web.config..."

$pythonExe = Join-Path $venvPath "Scripts\python.exe"
$logDir    = Join-Path $BackendDest "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile   = Join-Path $logDir "python.log"

$backendWebConfig = Join-Path $BackendDest "web.config"
Set-Content -Path $backendWebConfig -Encoding UTF8 -Value @"
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <handlers>
      <add name="PythonFastAPI" path="*" verb="*"
           modules="httpPlatformHandler" resourceType="Unspecified"/>
    </handlers>
    <httpPlatform
      processPath="$pythonExe"
      arguments="-X utf8 -m uvicorn app.main:app --port %HTTP_PLATFORM_PORT% --host 127.0.0.1"
      workingDirectory="$BackendDest"
      stdoutLogEnabled="true"
      stdoutLogFile="$logFile"
      startupTimeLimit="60">
      <environmentVariables>
        <environmentVariable name="PYTHONUTF8" value="1" />
      </environmentVariables>
    </httpPlatform>
  </system.webServer>
</configuration>
"@

Write-OK "web.config generated"


# ── 6. Create runtime folders ─────────────────────────────────────────────────
Write-Step "Creating runtime folders..."
foreach ($dir in @("archives", "logs")) {
    New-Item -ItemType Directory -Force -Path (Join-Path $BackendDest $dir) | Out-Null
}
Write-OK "uploads / exports / archives / logs"


# ── Done ──────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "==========================================="
Write-Host "  Deploy complete!"
Write-Host "==========================================="
Write-Host ""
Write-Host "Next steps in IIS Manager:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  [Backend]"  -ForegroundColor Cyan
Write-Host "  Site root : $BackendDest"
Write-Host "  Port      : $BackendPort"
Write-Host "  App Pool  : No Managed Code (unmanaged)"
Write-Host ""
Write-Host "  [Frontend]" -ForegroundColor Cyan
Write-Host "  Site root : $FrontendDest"
Write-Host "  Port      : 3010 (or 80/443)"
Write-Host "  App Pool  : No Managed Code"
Write-Host "  Note      : Requires IIS URL Rewrite module"
Write-Host ""

$envDest = Join-Path $BackendDest ".env"
if (-not (Test-Path $envDest)) {
    Write-Host "  ACTION REQUIRED: Create .env at:" -ForegroundColor Red
    Write-Host "  $envDest" -ForegroundColor Red
}
Write-Host ""
