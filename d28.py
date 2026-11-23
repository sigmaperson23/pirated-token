import sys
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
print(repr(d[0x19d38f8:0x19d38f8+32]))
print(repr(d[0x19d38e0:0x19d3940]))
