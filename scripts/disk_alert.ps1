# disk_alert.ps1
# ตรวจ disk usage ทุก drive — ส่ง alert ถ้าเหลือ <20%
# ตั้ง Task Scheduler รันทุก 1 ชั่วโมง หรือรันเองได้เลย

param(
    [int]$ThresholdPct   = 20,
    [string]$LineToken   = $env:LINE_NOTIFY_TOKEN,
    [string]$AlertEmail  = $env:ALERT_EMAIL
)

$drives = Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Used -gt 0 }

foreach ($drive in $drives) {
    $totalGB = [math]::Round(($drive.Used + $drive.Free) / 1GB, 1)
    $freeGB  = [math]::Round($drive.Free / 1GB, 1)
    $usedPct = [math]::Round(($drive.Used / ($drive.Used + $drive.Free)) * 100, 1)
    $freePct = 100 - $usedPct

    Write-Host "Drive $($drive.Name): $freeGB GB free / $totalGB GB total ($freePct% free)"

    if ($freePct -lt $ThresholdPct) {
        $msg = "[Carmen AI] DISK ALERT: Drive $($drive.Name) เหลือเพียง $freePct% ($freeGB GB) จาก $totalGB GB"
        Write-Warning $msg

        # ── LINE Notify ──
        if ($LineToken) {
            try {
                Invoke-RestMethod -Uri "https://notify-api.line.me/api/notify" `
                    -Method POST `
                    -Headers @{ Authorization = "Bearer $LineToken" } `
                    -Body @{ message = $msg } | Out-Null
                Write-Host "LINE alert sent."
            } catch {
                Write-Warning "LINE notify failed: $_"
            }
        }

        # ── Email (ต้องมี SMTP configured) ──
        if ($AlertEmail) {
            try {
                Send-MailMessage -To $AlertEmail -From $AlertEmail `
                    -Subject "[Carmen AI] Disk Alert" -Body $msg `
                    -SmtpServer "localhost"
                Write-Host "Email alert sent to $AlertEmail."
            } catch {
                Write-Warning "Email alert failed: $_"
            }
        }

        if (-not $LineToken -and -not $AlertEmail) {
            Write-Warning "No alert channel configured. Set LINE_NOTIFY_TOKEN or ALERT_EMAIL env var."
        }
    }
}
