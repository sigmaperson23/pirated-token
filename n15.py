import sys, struct
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
for va in (0x1419d0d20, 0x1419d2928, 0x1419d5508, 0x1419bffa9):
    pat = struct.pack("<Q", va)
    j = -1; hits = []
    while True:
        j = d.find(pat, j + 1)
        if j < 0: break
        hits.append((j, struct.unpack_from("<Q", d, j+8)[0]))
    print(hex(va), hits[:8])
