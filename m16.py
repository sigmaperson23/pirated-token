import sys, struct
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
B = 0x140000000
# .rdata mapping cheat: file 0x19ac000 == va 0x1419ad000
def r(va, n):
    return d[va - B - 0x1000: va - B - 0x1000 + n]
print(repr(r(0x1419d3945, 45)))
print(repr(r(0x1419d1d6b, 41)))
print(repr(r(0x1419d0d60, 80)))
