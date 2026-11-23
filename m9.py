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
    return d[o:o+n] if o is not None else b"<bad>"
print("v2o(0x1419d38f8) =", hex(v2o(0x1419d38f8)))
print(repr(rd(0x1419d38f8, 40)))
print(repr(rd(0x1419d2713, 40)))
print("v2o(0x1419d2713) =", hex(v2o(0x1419d2713)))
