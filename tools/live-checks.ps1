$Host.UI.RawUI.WindowTitle = 'Switchyard: type check and screen tests'
$root = 'C:\Users\sixth\Desktop\Claude\Playground\switchyard'
Set-Location $root
Remove-Item "$root\tools\logs\checks.done" -ErrorAction SilentlyContinue
Start-Transcript -Path "$root\tools\logs\checks.log" -Force | Out-Null
Write-Host "`n== Type check ==" -ForegroundColor Cyan
npx tsc --noEmit 2>&1 | ForEach-Object { "$_" }
Write-Host "type check exit code: $LASTEXITCODE"
Write-Host "`n== Screen tests ==" -ForegroundColor Cyan
npx vitest run 2>&1 | ForEach-Object { "$_" }
Write-Host "tests exit code: $LASTEXITCODE"
Write-Host "`n== Screen build ==" -ForegroundColor Cyan
npx vite build 2>&1 | ForEach-Object { "$_" }
Write-Host "build exit code: $LASTEXITCODE"
Stop-Transcript | Out-Null
Write-Host "`nDone. This window stays open." -ForegroundColor Green
New-Item -ItemType File -Force "$root\tools\logs\checks.done" | Out-Null
