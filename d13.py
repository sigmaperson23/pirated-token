import sys, re
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
for a,b in [(0x19bfc00,0x19c0300),(0x19b8a00,0x19b8f00)]:
    print("=====", hex(a))
    print(d[a:b].decode("latin1").replace("\x00","|"))
