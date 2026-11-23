import sys, pefile
sys.stdout.reconfigure(encoding="utf-8")
p = pefile.PE(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe.orig")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe.orig", "rb").read()
B = p.OPTIONAL_HEADER.ImageBase
txt = [s for s in p.sections if s.Name.startswith(b".text")][0]
base = B + txt.VirtualAddress
for label, off in [("basic", 0x1a45ef8), ("pro", 0x1a45efd), ("free", 0x1a45f82)]:
    va = B + off
    pat = (va & 0xFFFFFFFF).to_bytes(4, "little")
    refs = []
    idx = txt.PointerToRawData
    while True:
        idx = d.find(pat, idx + 1, txt.PointerToRawData + txt.SizeOfRawData)
        if idx < 0: break
        o = idx - txt.PointerToRawData - 3
        rel = int.from_bytes(d[o:o+4], "little", signed=True)
        if base + o + 4 + rel == va:
            refs.append(hex(base + o))
    print(label, hex(va), refs[:8])
