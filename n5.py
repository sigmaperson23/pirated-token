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
lo = B + rd_sec.VirtualAddress; hi = lo + rd_sec.Misc_VirtualSize
outs = []
off = lo
while off < hi - 48:
    ok = True; names = []
    for k in range(2):
        sp, sl = struct.unpack("<QQ", rd(off + k*16, 16))
        s = rd(sp, sl)
        if not (0 < sl < 30 and s.isalpha() and s.islower()): ok = False; break
        names.append(s.decode())
    if ok:
        nxt = struct.unpack("<Q", rd(off + 32, 8))[0]
        outs.append((hex(off), names, hex(nxt)))
    off += 8
for o in outs[:60]: print(o)
print(len(outs))
