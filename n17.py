import sys, pefile
sys.stdout.reconfigure(encoding="utf-8")
p = pefile.PE(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
B = p.OPTIONAL_HEADER.ImageBase
txt = [s for s in p.sections if s.Name.startswith(b".text")][0]
start = txt.PointerToRawData; end = start + txt.SizeOfRawData
base_va = B + txt.VirtualAddress
targets = {"verifiedAtUnixMs": 0x1419bffbc, "wasEntitled": 0x1419bffcc, "userId": 0x1419bffb6}
hits = []
for off in range(start + 0x100, end - 8):
    b0 = d[off]
    if b0 not in (0x48, 0x4C, 0x49, 0x4D):
        continue
    rel = int.from_bytes(d[off+3:off+7], "little", signed=True)
    a = base_va + (off - start) + 7 + rel
    for n, v in targets.items():
        if a == v:
            hits.append((hex(base_va + off - start), n))
for h in hits[:30]: print(h)
print(len(hits))
