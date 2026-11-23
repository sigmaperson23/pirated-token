import sys
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
for a, b in [(0x19d28c0, 0x19d2a60), (0x19d0c80, 0x19d0e00), (0x19d5470, 0x19d5580), (0x19e1f680, 0x19e1f800), (0x19e1f2a0, 0x19e1f400)]:
    print("=====", hex(a))
    print(d[a:b].decode("latin1"))
