import sys, struct
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
i = d.find(b"struct OneEntitlementData")
print("name at", hex(i))
print(repr(d[i:i+700]))
