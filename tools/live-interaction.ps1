$Host.UI.RawUI.WindowTitle = 'Switchyard: testing keys, layout and clipboard'
$root = 'C:\Users\sixth\Desktop\Claude\Playground\switchyard'
Set-Location $root
Remove-Item "$root\tools\logs\interaction.done" -ErrorAction SilentlyContinue
Start-Transcript -Path "$root\tools\logs\interaction.log" -Force | Out-Null
Write-Host "`n== Unit tests ==" -ForegroundColor Cyan
npx vitest run 2>&1 | ForEach-Object { "$_" } | Select-Object -Last 5
npx tsc --noEmit 2>&1 | ForEach-Object { "$_" }
Write-Host "type check exit code: $LASTEXITCODE"
Write-Host "`n== Live test in the running app ==" -ForegroundColor Cyan
node tools\e2e-interaction.mjs 2>&1 | ForEach-Object { "$_" }
Write-Host "live test exit code: $LASTEXITCODE"
Stop-Transcript | Out-Null
Write-Host "`nDone. This window stays open." -ForegroundColor Green
New-Item -ItemType File -Force "$root\tools\logs\interaction.done" | Out-Null
