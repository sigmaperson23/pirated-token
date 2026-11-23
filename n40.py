import sys, pefile, struct
sys.stdout.reconfigure(encoding="utf-8")
p = pefile.PE(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe.orig")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe.orig", "rb").read()
B = p.OPTIONAL_HEADER.ImageBase
txt = [s for s in p.sections if s.Name.startswith(b".text")][0]
start = txt.PointerToRawData; end = start + txt.SizeOfRawData
base = B + txt.VirtualAddress
def refs(va):
    pat = struct.pack("<I", va & 0xFFFFFFFF)
    out = []
    idx = start
    while True:
        idx = d.find(pat, idx + 1, end)
        if idx < 0: break
        inst = base + (idx - start) - 3
        off = idx - start - 3
        rel = int.from_bytes(d[off:off+4], "little", signed=True)
        if base + (off) + 4 + rel == va:
            out.append(hex(base + off))
    return out
for name, va in [("offline-evidence-msg", 0x141a3f631), ("monthlyAllowance", 0x1419b8b70), ("evidence-key", 0x141a08e60)]:
    print(name, refs(va)[:10])
