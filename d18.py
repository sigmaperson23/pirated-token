import sys, struct, re
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()

def readpair(off):
    ptr, n = struct.unpack_from("<QQ", d, off)
    if not (0x141900000 <= ptr < 0x142000000) or not (0 < n < 64):
        return None
    o = ptr - 0x140000000
    s = d[o:o+n]
    if not re.fullmatch(rb"[A-Za-z_][A-Za-z0-9_]*", s):
        return None
    return s.decode()

def fields_of(name_off, count):
    out = []
    off = name_off
    while len(out) < count and off > 0x1000:
        p = readpair(off - 16)
        if p:
            out.append(p)
            off -= 16
        else:
            break
    return list(reversed(out))

for label, off, n in [("OneEntitlementResponse", 0x19d292f, 2), ("OneEntitlementData", 0x19d0d27, None), ("Entitlements", 0x19d5508, 4)]:
    print(label, fields_of(off, n or 12))
