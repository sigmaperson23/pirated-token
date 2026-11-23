import sys, pefile, capstone
sys.stdout.reconfigure(encoding="utf-8")
p = pefile.PE(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe.orig")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe.orig", "rb").read()
B = p.OPTIONAL_HEADER.ImageBase
txt = [s for s in p.sections if s.Name.startswith(b".text")][0]
base = B + txt.VirtualAddress
def refs(va):
    out = []
    pat = va.to_bytes(4, "little")
    idx = txt.PointerToRawData
    while True:
        idx = d.find(pat, idx + 1, txt.PointerToRawData + txt.SizeOfRawData)
        if idx < 0: break
        off = idx - txt.PointerToRawData - 3
        rel = int.from_bytes(d[off:off+4], "little", signed=True)
        if base + off + 4 + rel == va:
            out.append(hex(base + off))
    return out
for label, off in [("basic", 0x1a45ef8), ("free", 0x1a45f7d), ("pro", 0x1a45efd)]:
    va = B + off
    print(label, hex(va), refs(va)[:8])
