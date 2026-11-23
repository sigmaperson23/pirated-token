import sys, struct
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
def show(a,b):
    off=a
    while off < b:
        ptr,n = struct.unpack_from("<QQ", d, off)
        txt = ""
        if 0x140000000 <= ptr < 0x142000000:
            o = ptr - 0x140000000
            txt = d[o:o+n].decode("latin1")
        print(hex(off), hex(ptr), n, repr(txt))
        off += 16
print("--- before OneEntitlementResponse")
show(0x19d2740, 0x19d2920)
