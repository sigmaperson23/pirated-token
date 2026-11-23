import sys, struct
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
def tab(va, n, back=0):
    off = va - 0x140000000 - back*16
    for k in range(n + back):
        ln, ptr = struct.unpack_from("<QQ", d, off + k*16)
        s = d[ptr-0x140000000:ptr-0x140000000+ln] if 0x141000000 <= ptr < 0x142000000 and 0 < ln < 64 else b""
        print(hex(off+k*16), ln, repr(s))
print("--- OneEntitlementResponse table @0x1419d38f8")
tab(0x1419d38f8, 2, 2)
