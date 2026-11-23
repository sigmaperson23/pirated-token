import sys, struct
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe.orig", "rb").read()
def rd(va, n):
    return d[va - 0x140000000 - 0x1000: va - 0x140000000 - 0x1000 + n]
def walk(start_va, count, label):
    print("==", label)
    va = start_va
    for k in range(count):
        sp, sl = struct.unpack("<QQ", rd(va, 16))
        s = rd(sp, sl) if 0x141000000 <= sp < 0x142000000 and 0 < sl < 40 else b""
        print("  ", k, repr(s))
        va += 16
walk(0x1419d0102, 3, "from supportedSchemaVersion")
walk(0x1419d0043, 8, "from nsre")
