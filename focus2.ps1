$p = Get-Process bridgemind-one-rust -ErrorAction SilentlyContinue
$ws = New-Object -ComObject WScript.Shell
$ws.AppActivate($p.Id) | Out-Null
Start-Sleep -Seconds 2
