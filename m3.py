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
def table(va, n, back=0):
    out = []
    for k in range(-back, n):
        raw = read(va + k*16, 16)
        if len(raw) < 16: out.append(None); continue
        ptr, ln = struct.unpack("<QQ", raw)
        out.append(read(ptr, ln).decode("latin1"))
    return out
print("Resp:", table(0x1419d38f8, 4, 2))
