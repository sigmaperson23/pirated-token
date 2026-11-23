import sys, struct
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
B = 0x140000000
def r(va, n):
    return d[va - B - 0x1000: va - B - 0x1000 + n]
# print 8 (ptr,len) pairs around 0x19d0d98 area (which sits right after the name string)
print("region 0x19d0d70..0x19d0eb0")
for off in range(0x19d0d70, 0x19d0eb0, 16):
    a, b = struct.unpack("<QQ", d[off:off+16])
    s = ""
    if 0x141900000 <= a < 0x142000000 and 0 < b < 40:
        s = r(a, b).decode("latin1")
    print(hex(off), hex(a), b, repr(s))
