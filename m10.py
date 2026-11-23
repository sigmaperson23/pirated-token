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
rd_sec = [s for s in p.sections if s.Name.startswith(b".rdata")][0]
lo = B + rd_sec.VirtualAddress
hi = lo + rd_sec.Misc_VirtualSize
hits = []
for va in range(lo, hi - 200, 8):
    for n in (2, 3, 4, 5):
        names = []
        ok = True
        for k in range(n):
            raw = rd(va + k*16, 16)
            if len(raw) < 16: ok = False; break
            sp, sl = struct.unpack("<QQ", raw)
            s = rd(sp, sl)
            if not (0 < sl < 40 and s.isalpha() and s.islower()):
                ok = False; break
            names.append(s.decode())
        if ok and any(x in names for x in ("access", "snapshot", "entitled", "verdict")):
            hits.append((hex(va), names))
for h in hits[:40]:
    print(h)
print("total", len(hits))
