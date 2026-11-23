import sys, struct
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
print(repr(d[0x1a03e00:0x1a040a0].decode("latin1")))
print("=== near 0x1a45ef0")
print(repr(d[0x1a45ec0:0x1a45f60].decode("latin1")))
