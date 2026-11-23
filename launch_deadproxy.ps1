$env:HTTPS_PROXY = 'http://127.0.0.1:9'
$env:HTTP_PROXY = 'http://127.0.0.1:9'
$env:ALL_PROXY = 'http://127.0.0.1:9'
Start-Process 'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe'
Start-Sleep -Seconds 25
