$Host.UI.RawUI.WindowTitle = 'Switchyard: restart test'
$root = 'C:\Users\sixth\Desktop\Claude\Playground\switchyard'
Set-Location $root
Remove-Item "$root\tools\logs\restart.done" -ErrorAction SilentlyContinue
Start-Transcript -Path "$root\tools\logs\restart.log" -Force | Out-Null

Write-Host "`n== Before the restart ==" -ForegroundColor Cyan
node tools\restart-check.mjs before 2>&1 | ForEach-Object { "$_" }
$before = $LASTEXITCODE

Write-Host "`n== Kill the app hard, like a crash ==" -ForegroundColor Cyan
Get-Process switchyard -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 4
$keeper = Get-Process -Name 'switchyard-keeper-v*' -ErrorAction SilentlyContinue
if ($keeper) { Write-Host "Keeper still running: process $($keeper.Id)" -ForegroundColor Green }
else { Write-Host 'Keeper is gone' -ForegroundColor Red }
# The old screen server can outlive the app. Free its port so the new run can use it.
Get-NetTCPConnection -LocalPort 1520 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }

Write-Host "`n== Start the app again ==" -ForegroundColor Cyan
Start-Process powershell -ArgumentList '-NoExit', '-ExecutionPolicy', 'Bypass', '-File', "$root\tools\live-dev.ps1"
Start-Sleep -Seconds 3
node tools\restart-check.mjs after 2>&1 | ForEach-Object { "$_" }
$after = $LASTEXITCODE

Write-Host "`nbefore exit code: $before, after exit code: $after"
Stop-Transcript | Out-Null
Write-Host "`nDone. This window stays open." -ForegroundColor Green
New-Item -ItemType File -Force "$root\tools\logs\restart.done" | Out-Null
