import sys, struct
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
lo, hi = 0x1419d2700, 0x1419d2c00
found = []
for off in range(0, len(d) - 8, 8):
    v = struct.unpack_from("<Q", d, off)[0]
    if lo <= v < hi:
        found.append((off, v))
print(len(found))
for off, v in found[:60]:
    print(hex(off), hex(v), repr(d[v - 0x140000000: v - 0x140000000 + 50]))
