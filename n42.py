import sys, struct, pefile
sys.stdout.reconfigure(encoding="utf-8")
p = pefile.PE(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe.orig")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe.orig", "rb").read()
B = p.OPTIONAL_HEADER.ImageBase
def v2o(va):
    for s in p.sections:
        if s.VirtualAddress <= va - B < s.VirtualAddress + s.SizeOfRawData:
            return s.PointerToRawData + (va - B - s.VirtualAddress)
for target in (b"userId", b"wasEntitled", b"verifiedAtUnixMs"):
    idx = d.find(target)
    va = B + idx  # only accidental, use search over both encodings
    pats = [struct.pack("<Q", B + i) for i in ()]
    hits = []
    for cand_va in (0x1419c0fb6, 0x141a3f631):
        pass
    print(target.decode(), "file", hex(idx))
# real: scan all qwords for pointers into the range covering the strings
lo, hi = 0x1419b0000, 0x141a50000
recs = []
for off in range(0, len(d) - 16, 8):
    a = struct.unpack_from("<Q", d, off)[0]
    b = struct.unpack_from("<Q", d, off + 8)[0]
    if lo <= a < hi and 2 <= b <= 30:
        recs.append((off, a))
print("total records in range:", len(recs))
texts = {}
for off, a in recs:
    o = v2o(a)
    if o is None: continue
    s = d[o:o+30].split(b"\x00")[0]
    texts[off] = s
for name in (b"userId", b"wasEntitled", b"verifiedAtUnixMs"):
    found = [hex(o) for o, s in texts.items() if s == name]
    print(name.decode(), found[:8])
