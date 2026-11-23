import sys, struct
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
B = 0x140000000
def at(off, n):
    return d[off:off+n]
def va_to_off(va):
    # .rdata: va_base 0x19ad000 -> file 0x19ac000
    return va - B - 0x19ad000 + 0x19ac000
def read_va(va, n):
    o = va_to_off(va)
    return d[o:o+n]
def dump(label, pairstr_off):
    ptr, ln = struct.unpack("<QQ", at(pairstr_off, 16))
    print(label, "table_va", hex(ptr), "bytes", ln)
    o = va_to_off(ptr)
    for k in range(ln // 16):
        p2, l2 = struct.unpack("<QQ", d[o+k*16:o+k*16+16])
        print("   ", repr(read_va(p2, l2)))
dump("GROW_OneEntitlementResponse", 0x19d28f0)
dump("GROW_OneEntitlementData", 0x19d0d18)
