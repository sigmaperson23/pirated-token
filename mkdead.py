B = chr(92)
EXE = "C:" + B + "Users" + B + "sixth" + B + "AppData" + B + "Local" + B + "BridgeMind One" + B + "bridgemind-one-rust.exe"
d = "http://127.0.0.1:9"
NL = chr(10)
lines = [
    "$env:HTTPS_PROXY = '" + d + "'",
    "$env:HTTP_PROXY = '" + d + "'",
    "$env:ALL_PROXY = '" + d + "'",
    "Start-Process '" + EXE + "'",
    "Start-Sleep -Seconds 25",
]
open("launch_deadproxy.ps1", "w", encoding="utf-8").write(NL.join(lines) + NL)
print(open("launch_deadproxy.ps1").read())
