import sys, pefile
sys.stdout.reconfigure(encoding="utf-8")
p = pefile.PE(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
B = p.OPTIONAL_HEADER.ImageBase
def v2o(va):
    for s in p.sections:
        if s.VirtualAddress <= va - B < s.VirtualAddress + s.SizeOfRawData:
            return s.PointerToRawData + (va - B - s.VirtualAddress)
for name, va in [("schemaVersion", 0x1419bffa9), ("userId", 0x1419bffb6)]:
    pat = va.to_bytes(4, "little")
    j = -1
    c = 0
    print("==", name)
    while c < 10:
        j = d.find(pat, j + 1)
        if j < 0: break
        # check it's the tail of a rip-relative lea
        if 0x100 < j:
            print(hex(j), "op", d[j-3:j].hex(), "va", hex(B + (j - 0)))
            c += 1
hits = []
pat = (0x1419bffbc).to_bytes(4, "little")
j = -1
while True:
    j = d.find(pat, j+1)
    if j < 0: break
    hits.append(hex(j))
print("verifiedAt hits", hits[:20], len(hits))
