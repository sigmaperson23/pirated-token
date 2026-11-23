import sys, struct, pefile
sys.stdout.reconfigure(encoding="utf-8")
path = r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe"
p = pefile.PE(path); d = open(path, "rb").read(); B = p.OPTIONAL_HEADER.ImageBase
def v2o(va):
    for s in p.sections:
        if s.VirtualAddress <= va - B < s.VirtualAddress + s.SizeOfRawData:
            return s.PointerToRawData + (va - B - s.VirtualAddress)
def rd(va, n):
    o = v2o(va)
    return d[o:o+n] if o is not None else b""
def name_at(va):
    o = v2o(va)
    if o is None: return b"?"
    return d[o:o+40].split(b"\x00")[0]

for target_label, target_va in [("OneEntitlementResponse", 0x1419d2928), ("OneEntitlementData", 0x1419d0d20)]:
    print("=====", target_label)
    to = v2o(target_va)
    for off in range(to - 0x400, to, 16):
        a, b = struct.unpack("<QQ", d[off:off+16])
        if 0x141900000 <= a < 0x142000000 and 0 < b < 40:
            s = rd(a, b)
            if s and all(97 <= c <= 122 or c == 95 for c in s):
                print("  ", hex(off), repr(s))
