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
lo = B + rd_sec.VirtualAddress
hi = lo + rd_sec.Misc_VirtualSize
for name in ("userId", "wasEntitled", "schemaVersion", "bridgeSpace"):
    print("==", name)
    n = 0
    off = rd_sec.PointerToRawData
    while off < rd_sec.PointerToRawData + rd_sec.SizeOfRawData - 16 and n < 6:
        ln = struct.unpack_from("<Q", d, off)[0]
        ptr = struct.unpack_from("<Q", d, off + 8)[0]
        if ln == len(name) and lo <= ptr < hi:
            o = va2off(ptr)
            if d[o:o+ln] == name.encode():
                print("   ", hex(off), "va", hex(off + 0x140001000))
                n += 1
        off += 8
