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
for tgt in ("entitlement", "data", "access", "kind"):
    idx = d.find(tgt.encode())
    while idx >= 0 and idx < 0x1f00000:
        va = B + idx
        pat = struct.pack("<Q", va)
        j = -1
        while True:
            j = d.find(pat, j + 1)
            if j < 0: break
            ln = struct.unpack_from("<Q", d, j - 8)[0]
            if abs(ln - len(tgt)) < 2:
                print(tgt, "va", hex(va), "record", hex(j - 8), "len", ln)
        idx = d.find(tgt.encode(), idx + 1)
