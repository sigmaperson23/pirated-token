import sys, struct
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
B = 0x140001000
def va(fo): return fo + B
def fo(va_): return va_ - B
def rd(va_, n): return d[fo(va_): fo(va_) + n]
def fields(name_file_off, label):
    name_va = va(name_file_off)
    pat = struct.pack("<Q", name_va)
    j = -1
    recs = []
    while True:
        j = d.find(pat, j + 1)
        if j < 0: break
        recs.append(j)
    print("==", label, "name_va", hex(name_va), "records", [hex(x) for x in recs])
    for r0 in recs:
        tbl_va, tbl_len = struct.unpack("<QQ", rd(va(r0 + 8), 16))
        print("   record", hex(r0), "table", hex(tbl_va), "len", tbl_len)
        if 0 < tbl_len < 400 and 0x141900000 <= tbl_va < 0x142000000:
            names = []
            for k in range(tbl_len // 16):
                sp, sl = struct.unpack("<QQ", rd(tbl_va + k*16, 16))
                names.append(rd(sp, sl).decode("latin1"))
            print("      ", names)
fields(0x19d2928, "OneEntitlementResponse")
fields(0x19d0d20, "OneEntitlementData")
fields(0x19d5508, "Entitlements")
