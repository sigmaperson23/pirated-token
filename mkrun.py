B = chr(92)
NL = chr(10)
exe = "C:" + B + "Users" + B + "sixth" + B + "AppData" + B + "Local" + B + "BridgeMind One" + B + "bridgemind-one-rust.exe"
here = "C:" + B + "Users" + B + "sixth" + B + "Desktop" + B + "Claude" + B + "Playground" + B + "switchyard"
ca = here + B + "mitm-ca.pem"
mitm = "C:" + B + "Users" + B + "sixth" + B + "AppData" + B + "Local" + B + "Python" + B + "pythoncore-3.14-64" + B + "Scripts" + B + "mitmdump.exe"
addon = here + B + "addon.py"
log = here + B + "capture" + B + "run.log"
lines = [
  "# start the entitlement proxy and launch BridgeMind through it",
  "# usage:  pwsh -File run.ps1",
  "$ErrorActionPreference = 'Stop'",
  "$root = '" + here + "'",
  "$exe  = '" + exe + "'",
  "$mitm = '" + mitm + "'",
  "$ca   = '" + ca + "'",
  "$addon = '" + addon + "'",
  "",
  "if (-not (Test-Path $ca)) { throw 'mitm-ca.pem missing, regenerate it with mitmdump once' }",
  "if (-not (Test-Path $addon)) { throw 'addon.py missing' }",
  "",
  "if (Get-Process mitmdump -ErrorAction SilentlyContinue) {",
  "  Write-Host 'proxy already running'",
  "} else {",
  "  Start-Process -FilePath $mitm -ArgumentList '--listen-port','8080','--set','confdir=' + (Join-Path $env:USERPROFILE '.mitmproxy'),'-s',$addon -RedirectStandardOutput $log -RedirectStandardError ($log + '.err') -WindowStyle Hidden",
  "  for ($i = 0; $i -lt 40; $i++) {",
  "    Start-Sleep -Milliseconds 250",
  "    if (Test-NetConnection 127.0.0.1 -Port 8080 -InformationLevel Quiet -WarningAction SilentlyContinue) { break }",
  "  }",
  "  Write-Host 'proxy up on 127.0.0.1:8080'",
  "}",
  "",
  "Get-Process bridgemind-one-rust -ErrorAction SilentlyContinue | Stop-Process -Force",
  "Start-Sleep -Seconds 2",
  "",
  "$env:HTTPS_PROXY = 'http://127.0.0.1:8080'",
  "$env:HTTP_PROXY  = 'http://127.0.0.1:8080'",
  "$env:ALL_PROXY   = 'http://127.0.0.1:8080'",
  "$env:SSL_CERT_FILE = $ca",
  "Start-Process -FilePath $exe",
  "Write-Host 'app launched. if the wall shows, close and run this again once.'",
]
open("run.ps1", "w", encoding="utf-8").write(NL.join(lines) + NL)

stopl = [
  "# stop BridgeMind and the proxy, and undo the proxy env for this shell",
  "Get-Process bridgemind-one-rust -ErrorAction SilentlyContinue | Stop-Process -Force",
  "Get-Process mitmdump -ErrorAction SilentlyContinue | Stop-Process -Force",
  "Remove-Item Env:HTTPS_PROXY, Env:HTTP_PROXY, Env:ALL_PROXY, Env:SSL_CERT_FILE -ErrorAction SilentlyContinue",
  "Write-Host 'stopped'",
]
open("stop.ps1", "w", encoding="utf-8").write(NL.join(stopl) + NL)
print("written")
