import sys, struct
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
for name, va in [("schemaVersion", 0x1419c0fa9), ("verifiedAtUnixMs", 0x1419c0fbc), ("wasEntitled", 0x1419c0fcc), ("userId", 0x1419c0fb6)]:
    pat = struct.pack("<Q", va)
    hits = []
    j = -1
    while len(hits) < 10:
        j = d.find(pat, j + 1)
        if j < 0: break
        hits.append((hex(j), struct.unpack_from("<Q", d, j + 8)[0]))
    print(name, hits)
