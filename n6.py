import sys, pefile
sys.stdout.reconfigure(encoding="utf-8")
p = pefile.PE(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
B = p.OPTIONAL_HEADER.ImageBase
def v2o(va):
    for s in p.sections:
        if s.VirtualAddress <= va - B < s.VirtualAddress + s.SizeOfRawData:
            return s.PointerToRawData + (va - B - s.VirtualAddress)
txt = [s for s in p.sections if s.Name.startswith(b".text")][0]
start = txt.PointerToRawData; end = start + txt.SizeOfRawData
targets = {"verifiedAtUnixMs": 0x1419bffbc, "wasEntitled": 0x1419bffcc, "userId": 0x1419bffb6, "schemaVersion": 0x1419bffa9}
hits = []
for off in range(start, end - 8):
    for name, va in targets.items():
        rel = int.from_bytes(d[off:off+4], "little", signed=True)
        if B + txt.VirtualAddress + (off - start) + 4 + rel == va:
            hits.append((hex(B + txt.VirtualAddress + off - start), name))
for h in hits[:40]: print(h)
print(len(hits))
