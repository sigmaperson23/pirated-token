$Host.UI.RawUI.WindowTitle = 'Switchyard: check build tools'
$root = 'C:\Users\sixth\Desktop\Claude\Playground\switchyard'
New-Item -ItemType Directory -Force "$root\tools\logs" | Out-Null
Start-Transcript -Path "$root\tools\logs\check-env.log" -Force | Out-Null

Write-Host "`n== Build tools ==" -ForegroundColor Cyan
foreach ($t in 'node', 'npm', 'pnpm', 'bun', 'cargo', 'rustc', 'rustup', 'git', 'gh', 'python') {
    $c = Get-Command $t -ErrorAction SilentlyContinue
    if ($c) {
        $v = try { (& $t --version 2>&1 | Select-Object -First 1) } catch { '?' }
        Write-Host ("{0,-8} {1}  ({2})" -f $t, $v, $c.Source)
    } else { Write-Host ("{0,-8} MISSING" -f $t) -ForegroundColor Yellow }
}

Write-Host "`n== Rust default target ==" -ForegroundColor Cyan
if (Get-Command rustup -ErrorAction SilentlyContinue) { rustup show active-toolchain 2>&1 }

Write-Host "`n== C++ build tools ==" -ForegroundColor Cyan
$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
if (Test-Path $vswhere) {
    & $vswhere -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property displayName
} else { Write-Host 'vswhere not found' -ForegroundColor Yellow }

Write-Host "`n== WebView2 runtime ==" -ForegroundColor Cyan
$wv = Get-ItemProperty 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}' -ErrorAction SilentlyContinue
if ($wv) { Write-Host "WebView2 $($wv.pv)" } else { Write-Host 'not found in machine registry' -ForegroundColor Yellow }

Write-Host "`n== Coding agents on this computer ==" -ForegroundColor Cyan
foreach ($a in 'claude', 'codex', 'cursor-agent', 'gemini', 'copilot', 'aider', 'kimi', 'droid', 'grok', 'opencode', 'amp') {
    $c = Get-Command $a -ErrorAction SilentlyContinue
    if ($c) { Write-Host ("{0,-14} {1}" -f $a, $c.Source) -ForegroundColor Green } else { Write-Host ("{0,-14} -" -f $a) }
}

Stop-Transcript | Out-Null
Write-Host "`nDone. This window stays open." -ForegroundColor Green
New-Item -ItemType File -Force "$root\tools\logs\check-env.done" | Out-Null
