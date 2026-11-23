$env:HTTPS_PROXY = "http://127.0.0.1:8080"
$env:HTTP_PROXY = "http://127.0.0.1:8080"
$env:ALL_PROXY = "http://127.0.0.1:8080"
$env:SSL_CERT_FILE = "C:\Users\sixth\Desktop\Claude\Playground\switchyard\mitm-ca.pem"
$exe = Join-Path $env:LOCALAPPDATA "BridgeMind One\bridgemind-one-rust.exe"
Start-Process -FilePath $exe
Start-Sleep -Seconds 15
if (Test-Path capture\raw.jsonl) { (Get-Content capture\raw.jsonl | Measure-Object -Line).Lines } else { "no capture yet" }
