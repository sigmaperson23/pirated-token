import sys, struct
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
B = 0x140000000
def s(off, n):
    return d[off:off+n].decode("latin1")
for rec in (0x19cfa80, 0x19d1900-0x10, 0x19d2648-0x10):
    print("==== record base", hex(rec))
    for k in range(10):
        off = rec + k*16
        ptr, ln = struct.unpack_from("<QQ", d, off)
        txt = ""
        if 0x141000000 <= ptr < 0x142000000 and 0 < ln < 40:
            o = ptr - B - 0x1000
            txt = d[o:o+ln].decode("latin1")
        print(hex(off), ln, repr(txt))
