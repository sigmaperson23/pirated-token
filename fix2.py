NL = chr(10)
p = "run.ps1"
lines = open(p, encoding="utf-8").read().split(NL)
out = []
for l in lines:
    if l.strip().startswith("Start-Process -FilePath $mitm"):
        out.append("  $conf = Join-Path $env:USERPROFILE '.mitmproxy'")
        out.append("  $args = @('--listen-port','8080','--set',("confdir=$conf"),'-s',$addon)")
        out.append("  $err = $log + '.err'")
        out.append("  Start-Process -FilePath $mitm -ArgumentList $args -RedirectStandardOutput $log -RedirectStandardError $err -WindowStyle Hidden")
    else:
        out.append(l)
open(p, "w", encoding="utf-8").write(NL.join(out))
print(NL.join(out))
