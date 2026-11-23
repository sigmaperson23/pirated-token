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
for off in range(0x19ea100, 0x19ea270, 16):
    ln = struct.unpack_from("<Q", d, off)[0]
    ptr = struct.unpack_from("<Q", d, off + 8)[0]
    s = b""
    if lo <= ptr < lo + rd_sec.Misc_VirtualSize and 0 < ln < 60:
        o = va2off(ptr)
        s = d[o:o+ln]
    print(hex(off), ln, repr(s))
