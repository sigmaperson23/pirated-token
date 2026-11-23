$Host.UI.RawUI.WindowTitle = 'Switchyard: new colours and fonts, then test'
$root = 'C:\Users\sixth\Desktop\Claude\Playground\switchyard'
Set-Location $root
Remove-Item "$root\tools\logs\restyle.done" -ErrorAction SilentlyContinue
Start-Transcript -Path "$root\tools\logs\restyle.log" -Force | Out-Null
Write-Host "`n== Change the stylesheet ==" -ForegroundColor Cyan
node tools\retheme.mjs
Write-Host "`n== Wait for the app to restart with its new settings ==" -ForegroundColor Cyan
Start-Sleep -Seconds 45
Write-Host "`n== Type check and screen tests ==" -ForegroundColor Cyan
npx tsc --noEmit 2>&1 | ForEach-Object { "$_" }
Write-Host "type check exit code: $LASTEXITCODE"
npx vitest run 2>&1 | ForEach-Object { "$_" } | Select-Object -Last 5
Write-Host "`n== Live test ==" -ForegroundColor Cyan
node tools\e2e.mjs
Write-Host "e2e exit code: $LASTEXITCODE"
Stop-Transcript | Out-Null
Write-Host "`nDone. This window stays open." -ForegroundColor Green
New-Item -ItemType File -Force "$root\tools\logs\restyle.done" | Out-Null
