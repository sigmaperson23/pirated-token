import sys, hashlib, pefile
PATCHES = [
    (0x1400B6FCA, bytes.fromhex("44885608"), bytes.fromhex("C6460802"), "store access as entitled"),
    (0x1400B7374, bytes.fromhex("BD02000000E903FCFFFF"), bytes.fromhex("41B202BD04000000E900FCFFFF"), "biz 403 -> entitled+ok"),
]
def va2off(pe, va):
    b = pe.OPTIONAL_HEADER.ImageBase
    for s in pe.sections:
        if s.VirtualAddress <= va - b < s.VirtualAddress + s.SizeOfRawData:
            return s.PointerToRawData + (va - b - s.VirtualAddress)
    raise SystemExit("unmapped")
def main(src):
    d = bytearray(open(src, "rb").read())
    pe = pefile.PE(data=bytes(d), fast_load=True)
    for va, old, new, n in PATCHES:
        o = va2off(pe, va)
        assert bytes(d[o:o+len(old)]) == old, (hex(va), d[o:o+len(old)].hex())
        d[o:o+len(new)] = new
    open(src, "wb").write(d)
    print("ok")
main(sys.argv[1])
