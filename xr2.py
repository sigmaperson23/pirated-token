import sys, struct
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
for va in (0x1419d292f, 0x1419d0d27, 0x1419d5508):
    pat = struct.pack("<Q", va)
    j = -1; hits = []
    while True:
        j = d.find(pat, j + 1)
        if j < 0: break
        hits.append(j)
    print(hex(va), [hex(h) for h in hits[:10]])
