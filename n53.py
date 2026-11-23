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
def dump_table(name_va, label, n_hint):
    print("==", label)
    pat = struct.pack("<Q", name_va)
    j = rd_sec.PointerToRawData
    while True:
        j = d.find(pat, j + 1, rd_sec.PointerToRawData + rd_sec.SizeOfRawData)
        if j < 0: break
        ln = struct.unpack_from("<Q", d, j - 8)[0]
        if not (0 < ln < 400 and ln % 16 == 0): continue
        print("   rec", hex(j - 8), "table bytes", ln)
        out = []
        for k in range(ln // 16):
            l2 = struct.unpack_from("<Q", d, j + 8 + k*16)[0]
            p2 = struct.unpack_from("<Q", d, j + 8 + k*16 + 8)[0]
            out.append(d[va2off(p2):va2off(p2)+l2].decode("latin1") if lo <= p2 < hi and l2 < 40 else "?")
        print("      ", out)
dump_table(0x1419d3945, "OneEntitlementResponse", 2)
dump_table(0x1419d1d27, "OneEntitlementData", 0)
