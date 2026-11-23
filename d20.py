import sys
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
for a, b in [(0x19d2830, 0x19d2938), (0x19d0c30, 0x19d0d60)]:
    print("=====", hex(a))
    print(d[a:b].decode("latin1"))
