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
def dump_struct(name_va, label):
    pat = struct.pack("<Q", name_va)
    j = -1
    while True:
        j = d.find(pat, j + 1)
        if j < 0: break
        size, n2 = struct.unpack("<QQ", d[j+8:j+24])
        print(label, "record@", hex(j), "size", size, "next", hex(n2))
        # try treat size as field-count * 16
        for cnt in (size // 16, size):
            fp = struct.unpack("<Q", d[j+8:j+16])[0]
            if 0x141900000 <= fp < 0x142000000:
                print("   fields:")
                for k in range(min(cnt, 12)):
                    e = rd(fp + k*16, 16)
                    if len(e) < 16: break
                    sp, sl = struct.unpack("<QQ", e)
                    sv = rd(sp, sl)
                    if sl < 40: print("      ", repr(sv))
dump_struct(0x1419d0d27 - 7, "OneEntitlementData")
dump_struct(0x1419d2928, "OneEntitlementResponse")
