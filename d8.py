import sys, re
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
for a,b in [(0x19d0b80,0x19d0d00),(0x19d0e00,0x19d0f80),(0x19d2800,0x19d2930)]:
    print("=====", hex(a))
    print(d[a:b].decode("latin1").replace("\x00","|"))
