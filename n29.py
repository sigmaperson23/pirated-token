import sys, struct
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe.orig", "rb").read()
def rd(va, n):
    # .rdata va 0x1419ad000 == file 0x19ac000
    return d[va - 0x140000000 - 0x1000: va - 0x140000000 - 0x1000 + n]
print("records pointing at OneEntitlementResponse name:")
name = 0x1419d3928
pat = struct.pack("<Q", name)
j = -1
recs = []
while True:
    j = d.find(pat, j + 1)
    if j < 0: break
    recs.append(j)
print([hex(x) for x in recs])
for r0 in recs:
    tbl, ln = struct.unpack("<QQ", d[r0+8:r0+24])
    print("rec", hex(r0), "table", hex(tbl), "bytes", ln)
    for k in range(ln // 16):
        sp, sl = struct.unpack("<QQ", rd(tbl + k*16, 16))
        print("    ", k, hex(sp), sl, repr(rd(sp, sl)))
