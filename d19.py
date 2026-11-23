import sys, struct
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
base = 0x140000000
for va in (0x1419d292f, 0x1419d2920, 0x1419d2928):
    o = va - base
    print(hex(va), repr(d[o-4:o+8]))
# also inspect the 24 bytes before the struct name
print("ctx", repr(d[0x19d2900:0x19d2960]))
