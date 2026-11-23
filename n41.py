import sys, struct
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe.orig", "rb").read()
def rd(va, n):
    o = va - 0x140001000
    return d[o:o+n] if 0 <= o < len(d) - n else b""
for target in (b"userId", b"wasEntitled", b"verifiedAtUnixMs", b"includedCredits"):
    idx = d.find(target)
    va = idx + 0x140001000
    if idx < 0: print(target, "missing"); continue
    print(target.decode(), "at va", hex(va))
    pat = struct.pack("<Q", va)
    j = -1
    hits = []
    while len(hits) < 10:
        j = d.find(pat, j + 1)
        if j < 0: break
        ln = struct.unpack_from("<Q", d, j - 8)[0]
        hits.append((hex(j - 8), ln))
    print("   (len,ptr) records:", hits)
