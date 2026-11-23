import sys, struct, pefile
sys.stdout.reconfigure(encoding="utf-8")
path = r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe"
p = pefile.PE(path); d = open(path, "rb").read(); B = p.OPTIONAL_HEADER.ImageBase
def v2o(va):
    for s in p.sections:
        if s.VirtualAddress <= va - B < s.VirtualAddress + s.SizeOfRawData:
            return s.PointerToRawData + (va - B - s.VirtualAddress)
def rd(va, n):
    o = v2o(va)
    return d[o:o+n] if o is not None else b""
sec = [s for s in p.sections if s.Name.startswith(b".rdata")][0]
lo = B + sec.VirtualAddress
hi = lo + sec.Misc_VirtualSize
out = []
va = lo
while va < hi - 32:
    a, b = struct.unpack("<QQ", rd(va, 16))
    s = rd(a, b)
    if 0 < b < 26 and s and all(97 <= c <= 122 or c == 95 for c in s):
        out.append((hex(va), s.decode()))
    va += 8
print(len(out))
for o in out:
    print(o[0], o[1])
