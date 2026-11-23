import sys, struct
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
def table(va, n):
    o = va - 0x140000000
    out = []
    for k in range(n):
        ptr, ln = struct.unpack_from("<QQ", d, o + k * 16)
        s = d[ptr - 0x140000000: ptr - 0x140000000 + ln]
        out.append(s.decode())
    return out
print("OneEntitlementResponse:", table(0x1419d38f8, 2))
# data struct: find its field table pair immediately before its name
print(repr(d[0x19d0cf0:0x19d0d30]))
