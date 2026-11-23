import sys, struct, pefile
sys.stdout.reconfigure(encoding="utf-8")
p = pefile.PE(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe.orig")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe.orig", "rb").read()
B = p.OPTIONAL_HEADER.ImageBase
def v2o(va):
    for s in p.sections:
        if s.VirtualAddress <= va - B < s.VirtualAddress + s.SizeOfRawData:
            return s.PointerToRawData + (va - B - s.VirtualAddress)
for target in (b"userId", b"wasEntitled", b"schemaVersion", b"bridgeSpace"):
    idx = d.find(target)
    va = B + idx if idx >= 0 else None
    print(target.decode(), "file", hex(idx), "as-if-va", hex(va) if va else None)
    if va is None: continue
    pat = struct.pack("<I", va & 0xFFFFFFFF)
    j = -1
    hits = []
    while len(hits) < 8:
        j = d.find(pat, j + 1)
        if j < 0: break
        hits.append(hex(j))
    print("   low32 refs:", hits)
