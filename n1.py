import sys, re
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
for pat in [b"includedCredits", b"dailyTranscriptions", b"voiceConcurrency", b"monthlyAllowance", b"paymentStatus", b"cancelAtPeriodEnd"]:
    i = d.find(pat)
    print("===", pat.decode(), hex(i) if i>0 else "none")
    if i > 0:
        print("   prev:", repr(d[max(0,i-120):i]))
        print("   next:", repr(d[i:i+120]))
