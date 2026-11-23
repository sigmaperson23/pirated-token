import sys, struct, pefile
sys.stdout.reconfigure(encoding="utf-8")
p = pefile.PE(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe.orig")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe.orig", "rb").read()
B = p.OPTIONAL_HEADER.ImageBase
def v2o(va):
    for s in p.sections:
        if s.VirtualAddress <= va - B < s.VirtualAddress + s.SizeOfRawData:
            return s.PointerToRawData + (va - B - s.VirtualAddress)
for start in (0x19cfa80, 0x19d1900 - 0x18, 0x19d4750 - 0x18):
    print("=====", hex(start))
    for k in range(12):
        off = start + k * 16
        ptr, ln = struct.unpack_from("<QQ", d, off)
        o = v2o(ptr)
        s = d[o:o+ln] if o is not None and 0 < ln < 40 else b""
        print(hex(off), ln, repr(s))
