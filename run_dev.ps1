# ============================================================
# run_dev.ps1 — Start backend (FastAPI) + frontend (Vite)
# Usage: .\run_dev.ps1
# ============================================================

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "Starting OCR Dev Environment" -ForegroundColor Cyan
Write-Host "  Backend  -> http://localhost:8010" -ForegroundColor Green
Write-Host "  Frontend -> http://localhost:3010" -ForegroundColor Green
Write-Host ""

# ── Backend ──────────────────────────────────────────────
$backendPath = Join-Path $ROOT "backend"
$venvPython  = Join-Path $backendPath "venv\Scripts\python.exe"

if (-Not (Test-Path $venvPython)) {
    Write-Host "[ERROR] venv not found at $venvPython" -ForegroundColor Red
    Write-Host "  Run: cd backend && python -m venv venv && venv\Scripts\activate && pip install -r requirements.txt"
    exit 1
}

$uvicorn = Join-Path $backendPath "venv\Scripts\uvicorn.exe"
$backendJob = Start-Process -FilePath $uvicorn -ArgumentList "app.main:app", "--port", "8010" `
    -WorkingDirectory $backendPath -PassThru -WindowStyle Normal

# ── Frontend ─────────────────────────────────────────────
$frontendPath = Join-Path $ROOT "frontend"

if (-Not (Test-Path (Join-Path $frontendPath "node_modules"))) {
    Write-Host "[ERROR] node_modules not found in $frontendPath" -ForegroundColor Red
    Write-Host "  Run: cd frontend && npm install"
    exit 1
}

$frontendJob = Start-Process -FilePath "powershell.exe" -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$frontendPath'; npm run dev"
) -PassThru -WindowStyle Normal

Write-Host "Both services started." -ForegroundColor Cyan
Write-Host "Close the terminal windows to stop them."
Write-Host ""
