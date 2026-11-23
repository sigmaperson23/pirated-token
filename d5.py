import sys, re
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
for pat in [b"upgradeRequired", b"unverified", b"entitled", b"bridgemindOne"]:
    print("====", pat.decode())
    i = -1
    for _ in range(8):
        i = d.find(pat, i + 1)
        if i < 0: break
        print(hex(i), repr(d[max(0,i-90):i+70]))
