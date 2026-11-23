import sys, struct, pefile
sys.stdout.reconfigure(encoding="utf-8")
p = pefile.PE(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe.orig")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe.orig", "rb").read()
B = p.OPTIONAL_HEADER.ImageBase
# check va 0x1419c0fb6 correctness: file offset of VA
for va in (0x1419c0fb6, 0x1419d1d27, 0x1419d3928):
    for s in p.sections:
        if s.VirtualAddress <= va - B < s.VirtualAddress + s.SizeOfRawData:
            o = s.PointerToRawData + (va - B - s.VirtualAddress)
            print(hex(va), "-> file", hex(o), repr(d[o:o+20]))
