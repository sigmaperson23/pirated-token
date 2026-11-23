import sys, struct
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe.orig", "rb").read()
va = 0x1419d3945
pat = struct.pack("<Q", va)
j = -1
hits = []
while True:
    j = d.find(pat, j + 1)
    if j < 0: break
    hits.append(j)
print("refs to", hex(va), [hex(h) for h in hits])
for h in hits[:5]:
    print(hex(h), "prev8", d[h-8:h].hex(" "), "next16", d[h+8:h+24].hex(" "))
