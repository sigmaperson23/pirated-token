import sys, struct
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe.orig", "rb").read()
def rd(va, n):
    return d[va - 0x140000000 - 0x1000: va - 0x140000000 - 0x1000 + n]
for off in range(0x19d0df0, 0x19d0ea0, 16):
    sp, sl = struct.unpack("<QQ", d[off:off+16])
    s = rd(sp, sl) if 0x141000000 <= sp < 0x142000000 and 0 < sl < 60 else b""
    ok = s and all(97 <= c <= 122 or c == 95 for c in s)
    print(hex(off), "va", hex(off + 0x140001000), sl, "FIELD" if ok else "", repr(s))
