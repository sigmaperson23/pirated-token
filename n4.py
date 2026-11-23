import sys
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
i = -1
n = 0
while n < 40:
    i = d.find(b"entitlement", i + 1)
    if i < 0: break
    ctx = d[max(0,i-40):i+60]
    if 0x1900000 < i < 0x1f00000:
        print(hex(i), repr(ctx))
        n += 1
