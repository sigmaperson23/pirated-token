import sys, pefile
sys.stdout.reconfigure(encoding="utf-8")
p = pefile.PE(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
B = p.OPTIONAL_HEADER.ImageBase
# E8 rel32 to 0x1400b6600
target = 0x1400b6600
txt = [s for s in p.sections if s.Name.startswith(b".text")][0]
start = txt.PointerToRawData
end = start + txt.SizeOfRawData
hits = []
for off in range(start, end - 5):
    if d[off] == 0xE8:
        rel = int.from_bytes(d[off+1:off+5], "little", signed=True)
        if B + txt.VirtualAddress + (off - start) + 5 + rel == target:
            hits.append(off)
print(len(hits))
for h in hits[:20]:
    print(hex(h), "va", hex(B + txt.VirtualAddress + (h - start)))
