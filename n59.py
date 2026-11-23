import sys, struct, pefile
sys.stdout.reconfigure(encoding="utf-8")
p = pefile.PE(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe.orig")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe.orig", "rb").read()
B = p.OPTIONAL_HEADER.ImageBase
txt = [s for s in p.sections if s.Name.startswith(b".text")][0]
base = B + txt.VirtualAddress
lo = 0x1400b7378
hi = 0x1400b7382
targets = set()
for off in range(txt.PointerToRawData, txt.PointerToRawData + txt.SizeOfRawData - 6):
    va = base + (off - txt.PointerToRawData)
    b0 = d[off]
    if b0 in (0xE9, 0xEB):
        n = 5 if b0 == 0xE9 else 2
        rel = int.from_bytes(d[off+1:off+n], "little", signed=True)
        t = va + n + rel
        if lo <= t <= hi: targets.add(hex(t))
    elif 0x70 <= b0 <= 0x7F or 0xE0 <= b0 <= 0xEF:
        pass
    elif b0 == 0x0F and 0x80 <= d[off+1] <= 0x8F:
        rel = int.from_bytes(d[off+2:off+6], "little", signed=True)
        t = va + 6 + rel
        if lo <= t <= hi: targets.add(hex(t))
print("targets into 0x1400b7378..0x1400b7381:", sorted(targets))
print("bytes", d[txt.PointerToRawData + 0x7374 - 0x6600 - 0x1000 + 0x1000:0][:0])
o = None
for s in p.sections:
    if s.VirtualAddress <= 0x1400b7374 - B < s.VirtualAddress + s.SizeOfRawData:
        o = s.PointerToRawData + (0x1400b7374 - B - s.VirtualAddress)
print("off", hex(o), d[o:o+16].hex(" "))
