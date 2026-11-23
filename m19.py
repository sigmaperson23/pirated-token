import sys
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
for pat in [b"includedCredits", b"canReopenBrowser", b"paymentRecovery", b"grandfathered", b"bridgeSpace", b"dailyTranscriptions"]:
    i = d.find(pat)
    print("====", pat.decode(), hex(i) if i > 0 else "none")
    if i > 0:
        print(repr(d[max(0,i-180):i+180]))
