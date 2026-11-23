import sys
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe.orig", "rb").read()
for t in (b"entitlement", b"data"):
    idx = d.find(t)
    print(t, hex(idx))
    print(repr(d[max(0,idx-60):idx+60]))
