import sys, struct
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe.orig", "rb").read()
def rd(va, n):
    o = va - 0x140001000
    return d[o:o+n] if 0 <= o < len(d) - n else b""
out = []
for off in range(0, len(d) - 16, 8):
    ptr, ln = struct.unpack_from("<QQ", d, off)
    if not (0x1419c0000 <= ptr < 0x141a00000) or not (2 <= ln <= 24):
        continue
    s = rd(ptr, ln)
    if len(s) == ln and all(97 <= c <= 122 or c == 95 for c in s):
        out.append((hex(off), s.decode()))
print(len(out))
for o in out[:80]:
    print(o)
