$Host.UI.RawUI.WindowTitle = 'Switchyard: testing the real app'
$root = 'C:\Users\sixth\Desktop\Claude\Playground\switchyard'
Set-Location $root
Remove-Item "$root\tools\logs\e2e.done" -ErrorAction SilentlyContinue
Start-Transcript -Path "$root\tools\logs\e2e.log" -Force | Out-Null
Write-Host "`n== Build the task board helper ==" -ForegroundColor Cyan
Push-Location src-tauri
cargo build --bin switchyard-tasks 2>&1 | ForEach-Object { "$_" } | Select-Object -Last 2
Pop-Location
Write-Host "`n== Screen tests ==" -ForegroundColor Cyan
npx vitest run 2>&1 | ForEach-Object { "$_" } | Select-Object -Last 5
npx tsc --noEmit 2>&1 | ForEach-Object { "$_" }
Write-Host "type check exit code: $LASTEXITCODE"
Write-Host "`n== Live test ==" -ForegroundColor Cyan
node tools\e2e.mjs 2>&1 | ForEach-Object { "$_" }
Write-Host "e2e exit code: $LASTEXITCODE"
Stop-Transcript | Out-Null
Write-Host "`nDone. This window stays open." -ForegroundColor Green
New-Item -ItemType File -Force "$root\tools\logs\e2e.done" | Out-Null
