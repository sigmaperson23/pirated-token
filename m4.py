import sys, struct, pefile
sys.stdout.reconfigure(encoding="utf-8")
path = r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe"
p = pefile.PE(path); d = open(path, "rb").read(); base = p.OPTIONAL_HEADER.ImageBase
def va2off(va):
    for s in p.sections:
        if s.VirtualAddress <= va - base < s.VirtualAddress + s.SizeOfRawData:
            return s.PointerToRawData + (va - base - s.VirtualAddress)
def read(va, n):
    o = va2off(va)
    return d[o:o+n] if o else b""
def fields(name_va, label):
    ptr, ln = struct.unpack("<QQ", read(name_va - 16, 16))
    print(label, "table", hex(ptr), "len", ln)
    for k in range((ln + 15) // 16):
        e = read(ptr + k * 16, 16)
        if len(e) < 16: break
        p2, l2 = struct.unpack("<QQ", e)
        print("   ", repr(read(p2, l2)))
fields(0x1419d0d20, "OneEntitlementData@0x19d0d20")
fields(0x1419d2928, "OneEntitlementResponse@0x19d2928")
