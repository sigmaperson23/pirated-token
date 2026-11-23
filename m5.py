import sys, struct, pefile
sys.stdout.reconfigure(encoding="utf-8")
path = r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe"
p = pefile.PE(path); d = open(path, "rb").read(); base = p.OPTIONAL_HEADER.ImageBase
rd = [s for s in p.sections if s.Name.startswith(b".rdata")][0]
def read(va, n):
    o = va - base
    if o < 0 or o + n > len(d): return b""
    return d[o:o+n]
lo = base + rd.VirtualAddress
hi = lo + rd.Misc_VirtualSize
off = lo
while off < hi - 32:
    nameptr, namelen, fptr, flen = struct.unpack("<QQQQ", read(off, 32))
    if base <= nameptr < base + 0x2400000 and 0 < namelen < 80 and flen % 32 == 0 and flen < 2000:
        s = read(nameptr, namelen)
        if s.startswith(b"struct ") and (b"Entitlement" in s or b"Entitlements" in s):
            print("REC", hex(off), hex(nameptr), namelen, repr(s), "fields", hex(fptr), flen)
            for k in range(flen // 32):
                e = read(fptr + k*32, 32)
                p2, l2 = struct.unpack("<QQ", e[:16])
                print("      ", repr(read(p2, l2)))
    off += 8
