import sys, struct
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe.orig", "rb").read()
def rd(va, n):
    return d[va - 0x140000000 - 0x1000: va - 0x140000000 - 0x1000 + n]
print(repr(rd(0x1419d3928, 110)))
print("--- pairs right after the name")
for k in range(0, 10):
    va = 0x1419d3928 + 0x20 + k * 16
    sp, sl = struct.unpack("<QQ", rd(va, 16))
    print(k, hex(va), hex(sp), sl, repr(rd(sp, sl)) if 0 < sl < 40 else "")
