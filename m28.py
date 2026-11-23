import sys, pefile
sys.stdout.reconfigure(encoding="utf-8")
p = pefile.PE(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
B = p.OPTIONAL_HEADER.ImageBase
def v2o(va):
    for s in p.sections:
        if s.VirtualAddress <= va - B < s.VirtualAddress + s.SizeOfRawData:
            return s.PointerToRawData + (va - B - s.VirtualAddress)
for a, n in [(0x1400b6ecf, 8), (0x1400b7374, 8), (0x1400b7054, 8), (0x1400b6f81, 8)]:
    o = v2o(a)
    print(hex(a), "off", hex(o), " ".join(f"{b:02X}" for b in d[o:o+n]))
