import sys, struct
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
B = 0x140000000
def rd(off, n):
    return d[off:off+n]
o = 0x19d2918
for k in range(-6, 8):
    off = o + k*8
    v = struct.unpack("<Q", d[off:off+8])[0]
    tag = ""
    if 0x141900000 <= v < 0x142000000:
        tag = repr(d[v - B - 0x1000: v - B - 0x1000 + 30])
    print(hex(off), hex(v), tag)
