# stop the proxy started by run.ps1 and undo what it changed
#
#   pwsh -File stop.ps1             close the app, stop our proxy, remove our CA
#   pwsh -File stop.ps1 -KeepApp    leave BridgeMind One running
#   pwsh -File stop.ps1 -KeepCa     leave the mitm CA trusted
#
# Only the proxy recorded in .mitm/proxy.json is touched. Other mitmdump or
# python instances, the user environment and the rest of the cert store are left
# exactly as they are.

param(
  [switch]$KeepApp,
  [switch]$KeepCa
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$stateDir = Join-Path $root '.mitm'
$state = Join-Path $stateDir 'proxy.json'
$addon = Join-Path $root 'addon.py'
$installMarker = Join-Path $stateDir 'ca-installed'
$keepMarker = Join-Path $stateDir 'ca-keep'

if (-not $KeepApp) {
  $apps = @(Get-Process bridgemind-one-rust -ErrorAction SilentlyContinue)
  foreach ($a in $apps) { $null = $a.CloseMainWindow() }
  for ($i = 0; $i -lt 20 -and (Get-Process bridgemind-one-rust -ErrorAction SilentlyContinue); $i++) { Start-Sleep -Milliseconds 250 }
  Get-Process bridgemind-one-rust -ErrorAction SilentlyContinue | Stop-Process -Force
  for ($i = 0; $i -lt 20 -and (Get-Process bridgemind-one-rust -ErrorAction SilentlyContinue); $i++) { Start-Sleep -Milliseconds 250 }
}

if (Test-Path $state) {
  $s = Get-Content $state -Raw | ConvertFrom-Json
  $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$($s.pid)" -ErrorAction SilentlyContinue
  if ($proc -and $proc.CommandLine -like "*$addon*") {
    & taskkill.exe /PID $s.pid /T /F 2>$null | Out-Null
    for ($i = 0; $i -lt 40; $i++) {
      Start-Sleep -Milliseconds 250
      if (-not (Get-CimInstance Win32_Process -Filter "ProcessId=$($s.pid)" -ErrorAction SilentlyContinue)) { break }
    }
    Write-Host "proxy on port $($s.port) stopped"
  } else {
    Write-Host 'recorded proxy was not running, nothing to stop'
  }
  Remove-Item $state -ErrorAction SilentlyContinue
} else {
  Write-Host 'no proxy recorded'
}

$keep = $KeepCa -or (Test-Path $keepMarker)
if (-not $keep -and (Test-Path $installMarker)) {
  $thumb = (Get-Content $installMarker -Raw).Trim()
  if ($thumb -and (Test-Path "Cert:\CurrentUser\Root\$thumb")) {
    & certutil.exe -user -delstore Root $thumb | Out-Null
    if (-not (Test-Path "Cert:\CurrentUser\Root\$thumb")) {
      Write-Host 'mitm CA removed from the user root store'
    } else {
      Write-Host 'mitm CA could not be removed, remove it with: certutil -user -delstore Root mitmproxy'
    }
  }
  Remove-Item $installMarker -ErrorAction SilentlyContinue
}
Remove-Item $keepMarker -ErrorAction SilentlyContinue

Write-Host 'stopped'
