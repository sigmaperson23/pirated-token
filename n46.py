import sys, struct, pefile
sys.stdout.reconfigure(encoding="utf-8")
p = pefile.PE(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe.orig")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe.orig", "rb").read()
B = p.OPTIONAL_HEADER.ImageBase
def va2off(va):
    for s in p.sections:
        if s.VirtualAddress <= va - B < s.VirtualAddress + s.SizeOfRawData:
            return s.PointerToRawData + (va - B - s.VirtualAddress)
rd_sec = [s for s in p.sections if s.Name.startswith(b".rdata")][0]
lo_off = rd_sec.PointerToRawData
hi_off = lo_off + rd_sec.SizeOfRawData
res = []
off = lo_off
while off < hi_off - 24:
    ln = struct.unpack_from("<Q", d, off)[0]
    ptr = struct.unpack_from("<Q", d, off + 8)[0]
    if 2 <= ln <= 26 and B + rd_sec.VirtualAddress <= ptr < B + rd_sec.VirtualAddress + rd_sec.Misc_VirtualSize:
        o = va2off(ptr)
        s = d[o:o+ln]
        if len(s) == ln and all(97 <= c <= 122 or c == 95 for c in s):
            res.append((hex(off), s.decode()))
    off += 8
print(len(res))
for x in res:
    if x[1] in ("userId", "wasEntitled", "schemaVersion", "verifiedAtUnixMs", "features", "bridgeSpace"):
        print("HIT", x)
