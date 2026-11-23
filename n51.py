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
for name_va, label in [(0x1419d1d20 + 7, "Data"), (0x1419d3928, "Resp"), (0x1419c0fb6, "userId")]:
    print("==", label, hex(name_va))
    pat = struct.pack("<Q", name_va)
    j = rd_sec.PointerToRawData
    while True:
        j = d.find(pat, j + 1, rd_sec.PointerToRawData + rd_sec.SizeOfRawData)
        if j < 0: break
        ln = struct.unpack_from("<Q", d, j - 8)[0]
        print("   rec", hex(j - 8), "len", ln)
        if 0 < ln < 400:
            tbl = j + 8
            names = []
            for k in range(ln // 16):
                l2 = struct.unpack_from("<Q", d, tbl + k*16)[0]
                p2 = struct.unpack_from("<Q", d, tbl + k*16 + 8)[0]
                if not (lo <= p2 < lo + rd_sec.Misc_VirtualSize) or l2 > 40: break
                names.append(d[va2off(p2):va2off(p2)+l2].decode("latin1"))
            print("      ", names)
