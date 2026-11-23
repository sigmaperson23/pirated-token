import sys
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe.orig", "rb").read()
i = d.find(b"basicentitledupgradeRequired")
print(hex(i), repr(d[i-40:i+80]))
