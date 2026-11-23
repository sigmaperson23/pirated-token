import sys, struct, pefile
sys.stdout.reconfigure(encoding="utf-8")
p = pefile.PE(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
base = p.OPTIONAL_HEADER.ImageBase
def off2va(off):
    for s in p.sections:
        if s.PointerToRawData <= off < s.PointerToRawData + s.SizeOfRawData:
            return base + s.VirtualAddress + (off - s.PointerToRawData)
    return None
def va2off(va):
    for s in p.sections:
        if s.VirtualAddress <= va - base < s.VirtualAddress + s.SizeOfRawData:
            return s.PointerToRawData + (va - base - s.VirtualAddress)
    return None
for off in (0x19d292f, 0x19d0d27, 0x19d5508, 0x19bffa9, 0x19c21e6):
    va = off2va(off)
    print("off", hex(off), "va", hex(va) if va else None, d[off:off+60].decode("latin1").split("\x00")[0])
    if va:
        for enc in ("<Q", "<I"):
            pat = struct.pack(enc, va)
            j = -1
            hits = []
            while True:
                j = d.find(pat, j + 1)
                if j < 0 or len(hits) > 6: break
                hits.append(hex(j))
            print("  ", enc, hits)
