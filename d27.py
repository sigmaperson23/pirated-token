import sys, struct
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
print(repr(d[0x19d48a0:0x19d4980]))
print("=== table region")
print(repr(d[0x19d38c0:0x19d3940]))
