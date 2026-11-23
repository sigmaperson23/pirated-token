import re, sys
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
for pat in [b"verifiedAt", b"wasEntitled", b"schemaVersion", b"userId", b"entitlement"]:
    print("====", pat.decode())
    i = -1
    n = 0
    while n < 12:
        i = d.find(pat, i + 1)
        if i < 0:
            break
        ctx = d[max(0, i - 70):i + 90]
        print(hex(i), ctx.decode("latin1").replace("\x00", "|"))
        n += 1
