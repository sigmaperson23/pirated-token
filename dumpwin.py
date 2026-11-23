import sys, re
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
# print all short lowercase ascii runs in window
for a in range(0x19d2800, 0x19d2c00):
    pass
seg = d[0x19d2700:0x19d2e00]
parts = re.findall(rb"[ -~]{3,60}", seg)
for p in parts:
    print(p.decode("latin1"))
