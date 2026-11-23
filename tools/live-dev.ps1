$Host.UI.RawUI.WindowTitle = 'Switchyard: running app (dev)'
$root = 'C:\Users\sixth\Desktop\Claude\Playground\switchyard'
Set-Location $root
# Opens a debug port for tools/e2e.mjs. Only this window's app gets it.
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = '--remote-debugging-port=9333'
npx tauri dev
