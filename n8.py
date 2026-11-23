import sys, struct
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
B = 0x140000000
def r(va, n):
    return d[va - B - 0x1000: va - B - 0x1000 + n]
print(repr(r(0x1419d0bcf, 6)))
print(repr(r(0x1419d0bd5, 5)))
print(repr(r(0x1419d0bda, 10)))
print(repr(r(0x1419d0be4, 7)))
print(repr(r(0x1419d0beb, 20)))
print("--- table at 0x19d0d18-stand-in")
for off in range(0x19d0cf0 + 0x0, 0x19d0d20, 16):
    print(hex(off), d[off:off+16].hex(" "))
