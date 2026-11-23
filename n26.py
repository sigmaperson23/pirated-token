import sys
sys.stdout.reconfigure(encoding="utf-8")
p = r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe"
d = open(p, "rb").read()
print("at b63ca:", d[0xB63CA:0xB63CE].hex(" "))
print("cmp inst at b62cf:", d[0xB62CF:0xB62D5].hex(" "))
