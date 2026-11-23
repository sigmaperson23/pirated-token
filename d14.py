import sys, struct, pefile, capstone
sys.stdout.reconfigure(encoding="utf-8")
p = pefile.PE(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
base = p.OPTIONAL_HEADER.ImageBase
def off2va(off):
    for s in p.sections:
        if s.PointerToRawData <= off < s.PointerToRawData + s.SizeOfRawData:
            return base + s.VirtualAddress + (off - s.PointerToRawData)
for off, n in [(0x19d0d2e, 18), (0x19d2936, 20)]:
    va = off2va(off)
    print(hex(off), hex(va), d[off:off+n])
    pat = struct.pack("<Q", va)
    j = -1
    while True:
        j = d.find(pat, j + 1)
        if j < 0: break
        print("   ref at", hex(j), "va", hex(off2va(j)) if off2va(j) else None)
