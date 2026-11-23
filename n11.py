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
def tbl(va, n, label):
    print("==", label)
    for k in range(n):
        sp, sl = struct.unpack("<QQ", rd(va + k*16, 16))
        print("   ", k, hex(sp), sl, repr(rd(sp, sl)))
# table ptr for OneEntitlementResponse record at 0x19d2918
sp, sl = struct.unpack("<QQ", d[0x19d2918:0x19d2928])
print("table va", hex(sp), "len", sl)
tbl(sp, sl // 16, "OneEntitlementResponse fields")
# OneEntitlementData record: find pair before name 0x19d0d20
for off in range(0x19d0d00, 0x19d0d20, 8):
    a, b = struct.unpack("<QQ", d[off:off+16])
    if 0x141900000 <= a < 0x142000000 and b and b % 16 == 0 and b < 400:
        print("cand", hex(off), hex(a), b)
        tbl(a, b // 16, "OneEntitlementData fields")
