import sys, struct
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
B = 0x140000000
def rf(off, n):
    return d[off:off+n]
def s(off):
    return d[off:off+60].split(b"\x00")[0].decode("latin1")
for off in range(0x19d28a0, 0x19d2a40, 16):
    a, b = struct.unpack("<QQ", rf(off, 16))
    tag = ""
    if 0x141900000 <= a < 0x142000000 and 0 < b < 90:
        tag = "-> " + repr(d[a - B - 0x1000: a - B - 0x1000 + b].decode("latin1"))
    print(hex(off), hex(a), b, tag[:110])
