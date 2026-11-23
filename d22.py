import sys, struct
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
print(repr(d[0x19d48c0:0x19d4900]))
print("--- table at 0x19d38f8")
print(repr(d[0x19d38f0:0x19d3920]))
