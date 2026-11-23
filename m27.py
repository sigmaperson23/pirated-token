import sys, struct
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
for off in range(0x19d2978, 0x19d2a40, 16):
    a, b = struct.unpack("<QQ", d[off:off+16])
    s = ""
    if 0x141900000 <= a < 0x142000000 and 0 < b < 80:
        s = d[a - 0x140000000: a - 0x140000000 + b].decode("latin1")
    print(hex(off), hex(a), b, repr(s))
