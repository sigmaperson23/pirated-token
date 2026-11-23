import sys, re
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
for pat in [b"verifiedAtUnixMs", b"accesskind", b"OneEntitlementData", b"subscriptionTier", b"requiredTier"]:
    print("====", pat.decode())
    i = -1
    for _ in range(6):
        i = d.find(pat, i + 1)
        if i < 0: break
        print(hex(i), d[max(0,i-120):i+120].decode("latin1").replace("\x00","|"))
