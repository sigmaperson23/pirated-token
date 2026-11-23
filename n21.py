import sys, struct
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
B = 0x140000000
for va in (0x1419d3928, 0x1419d1d20, 0x1419d6508):
    pat = struct.pack("<Q", va)
    j = -1; hits = []
    while True:
        j = d.find(pat, j + 1)
        if j < 0: break
        tbl_va, tbl_len = struct.unpack_from("<QQ", d, j + 8)
        hits.append((hex(j), hex(tbl_va), tbl_len))
    print(hex(va), hits[:6])
