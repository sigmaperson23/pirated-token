import sys, struct
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
B = 0x140000000
def rd(va, n):
    return d[va - B - 0x1000: va - B - 0x1000 + n]
for va, ln, label in [(0x1419d38f8, 32, "OneEntitlementResponse")]:
    print("==", label)
    for k in range(ln // 16):
        sp, sl = struct.unpack("<QQ", rd(va + k*16, 16))
        print("  ", k, hex(sp), sl, repr(rd(sp, sl)))
# data struct record
print("record @0x19d0d08..0x19d0d20")
for off in range(0x19d0d00, 0x19d0d20, 8):
    v = struct.unpack("<Q", d[off:off+8])[0]
    print(hex(off), hex(v), repr(rd(v, 30)) if 0x141900000 <= v < 0x142000000 else "")
