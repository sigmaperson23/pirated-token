import sys, struct
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
B = 0x140000000
def rd(va, n):
    return d[va - B - 0x1000: va - B - 0x1000 + n]
def pair(off):
    a, b = struct.unpack("<QQ", d[off:off+16])
    if not (0x141900000 <= a < 0x142000000) or not (0 < b < 26): return None
    s = rd(a, b)
    if not s or not all(97 <= c <= 122 or c == 95 for c in s): return None
    return s.decode()
for name_end, label in [(0x19d2918, "OneEntitlementResponse"), (0x19d0d18, "OneEntitlementData")]:
    print("==", label)
    off = name_end - 16
    got = []
    while off > 0x1000:
        p = pair(off)
        if not p: break
        got.append(p)
        off -= 16
    print(list(reversed(got)))
