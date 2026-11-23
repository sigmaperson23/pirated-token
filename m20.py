import sys, struct, pefile
sys.stdout.reconfigure(encoding="utf-8")
path = r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe"
p = pefile.PE(path); d = open(path, "rb").read(); B = p.OPTIONAL_HEADER.ImageBase
text_end = None
def v2o(va):
    for s in p.sections:
        if s.VirtualAddress <= va - B < s.VirtualAddress + s.SizeOfRawData:
            return s.PointerToRawData + (va - B - s.VirtualAddress)
def o2v(off):
    for s in p.sections:
        if s.PointerToRawData <= off < s.PointerToRawData + s.SizeOfRawData:
            return B + s.VirtualAddress + (off - s.PointerToRawData)
# find every occurrence of the text
needle = b"struct OneEntitlement"
i = -1
while True:
    i = d.find(needle, i + 1)
    if i < 0: break
    va = o2v(i)
    print("text at", hex(i), "va", hex(va) if va else None, repr(d[i:i+70]))
    if not va: continue
    pat = struct.pack("<Q", va)
    j = -1
    while True:
        j = d.find(pat, j + 1)
        if j < 0: break
        nxt = d[j+8:j+40]
        print("   ref", hex(j), "next", " ".join(f"{b:02x}" for b in nxt))
