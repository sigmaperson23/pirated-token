import sys
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe.orig", "rb").read()
print(repr(d[0x19cf102:0x19cf102+30]))
print(repr(d[0x19d0102 - 0x1000:0x19d0102 - 0x1000 + 30]))
