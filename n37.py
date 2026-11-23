import sys, re
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe.orig", "rb").read()
seg = d[0x19d0df8:0x19d0f80]
for p in re.findall(rb"[A-Za-z_]{2,30}", seg):
    print(p.decode())
