$Host.UI.RawUI.WindowTitle = 'Switchyard: Rust build and tests'
$root = 'C:\Users\sixth\Desktop\Claude\Playground\switchyard'
Set-Location $root
Start-Transcript -Path "$root\tools\logs\rust.log" -Force | Out-Null
Remove-Item "$root\tools\logs\rust.done" -ErrorAction SilentlyContinue
if (-not (Test-Path "$root\src-tauri\icons\icon.ico")) {
    Write-Host "`n== Make app icons ==" -ForegroundColor Cyan
    npx tauri icon icon.svg
}
Set-Location "$root\src-tauri"
Write-Host "`n== Rust tests ==" -ForegroundColor Cyan
cargo test 2>&1 | ForEach-Object { "$_" }
$code = $LASTEXITCODE
Write-Host "`ncargo test exit code: $code" -ForegroundColor $(if ($code -eq 0) { 'Green' } else { 'Red' })
Stop-Transcript | Out-Null
Write-Host "`nDone. This window stays open." -ForegroundColor Green
New-Item -ItemType File -Force "$root\tools\logs\rust.done" | Out-Null
