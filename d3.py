import sys
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
print(repr(d[0x19d38f8:0x19d3920]))
print(repr(d[0x19d38c0:0x19d3900]))
print("=== 0x19d1d00")
print(repr(d[0x19d1c80:0x19d1d40]))
