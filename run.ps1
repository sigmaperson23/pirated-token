# start the entitlement proxy and launch BridgeMind One through it
#
#   pwsh -File run.ps1                 normal use
#   pwsh -File run.ps1 -Port 8099      pick another port
#   pwsh -File run.ps1 -KeepCa         leave the mitm CA in the user root store
#   pwsh -File run.ps1 -NoLaunch       proxy only
#
# The proxy is private to this repo: own port, own confdir, own pid file, and it
# only MITMs api.bridgemind.ai. Everything else is tunnelled with real certs.
# The mitm CA is added to CurrentUser\Root for the run and removed by stop.ps1,
# so the system store, other mitmproxy installs and AWS CLI stay as they were.

param(
  [int]$Port = 8099,
  [switch]$KeepCa,
  [switch]$NoLaunch
)

$ErrorActionPreference = 'Stop'
if ($PSVersionTable.PSVersion -lt [version]'7.4') {
  throw "PowerShell 7.4+ required (Start-Process -Environment), found $($PSVersionTable.PSVersion)"
}
$root = $PSScriptRoot
$exe = Join-Path $env:LOCALAPPDATA 'BridgeMind One\bridgemind-one-rust.exe'
$stateDir = Join-Path $root '.mitm'
$conf = Join-Path $stateDir 'mitmproxy-ca.pem'
$ca = Join-Path $root 'mitm-ca.pem'
$cer = Join-Path $stateDir 'ca.cer'
$bundle = Join-Path $stateDir 'ca-bundle.pem'
$addon = Join-Path $root 'addon.py'
$log = Join-Path $stateDir 'run.log'
$err = Join-Path $stateDir 'run.log.err'
$state = Join-Path $stateDir 'proxy.json'
$installMarker = Join-Path $stateDir 'ca-installed'
$keepMarker = Join-Path $stateDir 'ca-keep'

New-Item -ItemType Directory -Force -Path $stateDir, (Join-Path $root 'capture') | Out-Null

if (-not (Test-Path $addon)) { throw "addon.py missing at $addon" }
if (-not (Test-Path $exe)) { throw "BridgeMind One not found at $exe" }

function Resolve-Mitmdump {
  $candidates = @()
  $candidates += Get-ChildItem -Path (Join-Path $env:LOCALAPPDATA 'Python\pythoncore-*\Scripts\mitmdump.exe') -ErrorAction SilentlyContinue
  $candidates += Get-ChildItem -Path (Join-Path $env:USERPROFILE '.local\bin\mitmdump.exe') -ErrorAction SilentlyContinue
  $onPath = Get-Command mitmdump -ErrorAction SilentlyContinue
  if ($onPath) { $candidates += Get-Item $onPath.Source }
  $hit = $candidates | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $hit) { throw 'mitmdump not found. install mitmproxy or pass it on PATH.' }
  return $hit.FullName
}

function Test-PortFree([int]$p) {
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $p)
  try { $listener.Start(); return $true } catch { return $false } finally { $listener.Stop() }
}

function Get-ProxyState {
  if (-not (Test-Path $state)) { return $null }
  try { return Get-Content $state -Raw | ConvertFrom-Json } catch { return $null }
}

function Test-OwnedProxy($s) {
  if (-not $s) { return $false }
  $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$($s.pid)" -ErrorAction SilentlyContinue
  if (-not $proc) { return $false }
  $cmd = $proc.CommandLine
  return $cmd -and ($cmd -like "*$addon*") -and ($cmd -like "*--listen-port $($s.port)*")
}

function Stop-Proxy($s) {
  if (-not (Test-OwnedProxy $s)) { return }
  & taskkill.exe /PID $s.pid /T /F 2>$null | Out-Null
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 250
    if (-not (Get-CimInstance Win32_Process -Filter "ProcessId=$($s.pid)" -ErrorAction SilentlyContinue)) { break }
  }
}

function Close-App {
  $apps = @(Get-Process bridgemind-one-rust -ErrorAction SilentlyContinue)
  if (-not $apps) { return }
  foreach ($a in $apps) { $null = $a.CloseMainWindow() }
  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 250
    if (-not (Get-Process bridgemind-one-rust -ErrorAction SilentlyContinue)) { return }
  }
  Get-Process bridgemind-one-rust -ErrorAction SilentlyContinue | Stop-Process -Force
  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 250
    if (-not (Get-Process bridgemind-one-rust -ErrorAction SilentlyContinue)) { return }
  }
  throw 'BridgeMind One would not close'
}

# --- CA material -----------------------------------------------------------
# mitmproxy must sign with the CA the repo already documents, so seed its
# confdir from mitm-ca.pem instead of letting it mint a fresh one.
if (-not (Test-Path $conf)) {
  if (Test-Path $ca) {
    Copy-Item $ca $conf
  } else {
    $mitm = Resolve-Mitmdump
    $tmpLog = Join-Path $stateDir 'ca-gen.log'
    $p = Start-Process -FilePath $mitm -ArgumentList @('--listen-port', '0', '--set', "confdir=$stateDir") `
      -RedirectStandardOutput $tmpLog -RedirectStandardError "$tmpLog.err" -WindowStyle Hidden -PassThru
    for ($i = 0; $i -lt 40; $i++) { Start-Sleep -Milliseconds 250; if (Test-Path $conf) { break } }
    & taskkill.exe /PID $p.Id /T /F 2>$null | Out-Null
    if (-not (Test-Path $conf)) { throw 'mitmproxy did not create a CA' }
    Copy-Item $conf $ca
  }
}
Copy-Item $conf $ca -Force

$cert = [System.Security.Cryptography.X509Certificates.X509Certificate2]::CreateFromPemFile($ca)
$thumb = $cert.Thumbprint
[System.IO.File]::WriteAllBytes($cer, $cert.RawData)

# Public roots plus the mitm CA, so tunneled hosts still validate if a client
# treats SSL_CERT_FILE as its whole trust store.
if (-not (Test-Path $bundle) -or (Get-Item $bundle).LastWriteTime -lt (Get-Date).AddDays(-7)) {
  $sb = [System.Text.StringBuilder]::new()
  foreach ($store in 'Cert:\LocalMachine\Root', 'Cert:\CurrentUser\Root') {
    foreach ($c in Get-ChildItem $store -ErrorAction SilentlyContinue) {
      if ($c.NotAfter -lt (Get-Date)) { continue }
      $null = $sb.AppendLine('-----BEGIN CERTIFICATE-----')
      $null = $sb.AppendLine([Convert]::ToBase64String($c.RawData, 'InsertLineBreaks'))
      $null = $sb.AppendLine('-----END CERTIFICATE-----')
    }
  }
  $null = $sb.AppendLine('-----BEGIN CERTIFICATE-----')
  $null = $sb.AppendLine([Convert]::ToBase64String($cert.RawData, 'InsertLineBreaks'))
  $null = $sb.AppendLine('-----END CERTIFICATE-----')
  [System.IO.File]::WriteAllText($bundle, $sb.ToString())
}

# --- reuse or start the proxy ---------------------------------------------
$existing = Get-ProxyState
if (Test-OwnedProxy $existing) {
  $Port = [int]$existing.port
  Write-Host "proxy already running on 127.0.0.1:$Port (pid $($existing.pid))"
} else {
  Remove-Item $state -ErrorAction SilentlyContinue
  $startPort = $Port
  while (-not (Test-PortFree $Port)) {
    $Port++
    if ($Port -gt $startPort + 10) { throw "no free port in $startPort..$($startPort + 10)" }
  }

  if ((Test-Path $log) -and (Get-Item $log).Length -gt 1MB) { Move-Item $log "$log.1" -Force }
  $mitm = Resolve-Mitmdump
  $argl = @(
    '--listen-host', '127.0.0.1',
    '--listen-port', "$Port",
    '--set', "confdir=$stateDir",
    '--set', 'allow_hosts=^api\.bridgemind\.ai(:\d+)?$',
    '--set', 'flow_detail=1',
    '-s', $addon
  )
  $proc = Start-Process -FilePath $mitm -ArgumentList $argl -RedirectStandardOutput $log `
    -RedirectStandardError $err -WindowStyle Hidden -PassThru

  $up = $false
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Milliseconds 250
    if ($proc.HasExited) { break }
    $tcp = [System.Net.Sockets.TcpClient]::new()
    try { $tcp.Connect('127.0.0.1', $Port); $up = $true; break } catch { } finally { $tcp.Dispose() }
  }
  if (-not $up) {
    & taskkill.exe /PID $proc.Id /T /F 2>$null | Out-Null
    Get-Content $err -Tail 15 -ErrorAction SilentlyContinue | ForEach-Object { Write-Host $_ }
    throw "proxy did not come up on 127.0.0.1:$Port (see $err)"
  }
  @{ pid = $proc.Id; port = $Port } | ConvertTo-Json | Set-Content $state
  Write-Host "proxy up on 127.0.0.1:$Port (pid $($proc.Id))"
}

# --- trust the CA for the run ---------------------------------------------
$already = Test-Path "Cert:\CurrentUser\Root\$thumb"
if (-not $already) {
  # certutil adds silently; Import-Certificate pops the "install this CA" dialog.
  & certutil.exe -user -addstore Root $cer | Out-Null
  if (-not (Test-Path "Cert:\CurrentUser\Root\$thumb")) { throw 'could not add the mitm CA to the user root store' }
  Set-Content $installMarker $thumb
  Write-Host 'mitm CA trusted for this run (removed by stop.ps1)'
} else {
  Write-Host 'mitm CA already trusted in the user store, left alone'
}
if ($KeepCa) { Set-Content $keepMarker $thumb } else { Remove-Item $keepMarker -ErrorAction SilentlyContinue }

if ($NoLaunch) { Write-Host 'proxy only, app not launched'; exit 0 }

# --- launch the app with a private environment ----------------------------
Close-App
$proxyUrl = "http://127.0.0.1:$Port"
$childEnv = @{
  HTTP_PROXY                = $proxyUrl
  HTTPS_PROXY               = $proxyUrl
  ALL_PROXY                 = $proxyUrl
  NO_PROXY                  = 'localhost,127.0.0.1,::1,169.254.169.254,.amazonaws.com,.amazonaws.com.cn,.sentry.io,downloads.bridgemind.ai'
  SSL_CERT_FILE             = $bundle
  NODE_EXTRA_CA_CERTS       = $bundle
  AWS_CA_BUNDLE             = $bundle
  CURL_CA_BUNDLE            = $bundle
  REQUESTS_CA_BUNDLE        = $bundle
}
Start-Process -FilePath $exe -Environment $childEnv
Write-Host "app launched through 127.0.0.1:$Port"
Write-Host 'if the wall shows, close the app and run this again once (the vault warms on the first pass).'
