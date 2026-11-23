$Host.UI.RawUI.WindowTitle = 'Switchyard: install packages'
$root = 'C:\Users\sixth\Desktop\Claude\Playground\switchyard'
Set-Location $root
Start-Transcript -Path "$root\tools\logs\install.log" -Force | Out-Null
Write-Host "`n== Screen packages ==" -ForegroundColor Cyan
npm install react react-dom zustand @xterm/xterm @xterm/addon-fit @xterm/addon-webgl @xterm/addon-web-links @tauri-apps/api @tauri-apps/plugin-notification @tauri-apps/plugin-dialog @tauri-apps/plugin-opener @fontsource-variable/overpass @fontsource-variable/jetbrains-mono
Write-Host "`n== Build packages ==" -ForegroundColor Cyan
npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom vitest @tauri-apps/cli
Write-Host "`n== Result ==" -ForegroundColor Cyan
npm ls --depth=0
Stop-Transcript | Out-Null
Write-Host "`nDone. This window stays open." -ForegroundColor Green
New-Item -ItemType File -Force "$root\tools\logs\install.done" | Out-Null
