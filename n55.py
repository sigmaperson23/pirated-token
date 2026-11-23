import sys, struct, pefile
sys.stdout.reconfigure(encoding="utf-8")
p = pefile.PE(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe.orig")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe.orig", "rb").read()
B = p.OPTIONAL_HEADER.ImageBase
def va2off(va):
    for s in p.sections:
        if s.VirtualAddress <= va - B < s.VirtualAddress + s.SizeOfRawData:
            return s.PointerToRawData + (va - B - s.VirtualAddress)
rd_sec = [s for s in p.sections if s.Name.startswith(b".rdata")][0]
lo = B + rd_sec.VirtualAddress
hi = lo + rd_sec.Misc_VirtualSize
def fieldstr(off):
    ln = struct.unpack_from("<Q", d, off)[0]
    ptr = struct.unpack_from("<Q", d, off + 8)[0]
    if not (lo <= ptr < hi) or not (1 <= ln <= 32): return None
    s = d[va2off(ptr):va2off(ptr)+ln]
    if not all(97 <= c <= 122 or c == 95 for c in s): return None
    return s.decode()
# find pair tables of exactly 2 that start with 'entitlement'
for off in range(rd_sec.PointerToRawData, rd_sec.PointerToRawData + rd_sec.SizeOfRawData - 64, 8):
    a = fieldstr(off)
    if a != "entitlement": continue
    b = fieldstr(off + 16)
    print(hex(off), "->", a, b)
