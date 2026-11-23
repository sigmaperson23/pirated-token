import sys, struct, pefile
sys.stdout.reconfigure(encoding="utf-8")
path = r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe"
p = pefile.PE(path)
d = open(path, "rb").read()
base = p.OPTIONAL_HEADER.ImageBase
def va2off(va):
    for s in p.sections:
        if s.VirtualAddress <= va - base < s.VirtualAddress + s.SizeOfRawData:
            return s.PointerToRawData + (va - base - s.VirtualAddress)
def read(va, n):
    o = va2off(va)
    return d[o:o+n] if o else b""
print("check", read(0x1419d48da, 8))
for va in (0x1419d0d27, 0x1419d292f, 0x1419d5508, 0x1419bffa9):
    print(hex(va), read(va, 50))
