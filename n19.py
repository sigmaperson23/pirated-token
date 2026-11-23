import sys
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
for name, va in [("schemaVersion", 0x19bffa9), ("userId", 0x19bffb6), ("verifiedAtUnixMs", 0x19bffbc), ("wasEntitled", 0x19bffcc)]:
    pat = va.to_bytes(4, "little")
    hits = []
    j = -1
    while len(hits) < 8:
        j = d.find(pat, j + 1)
        if j < 0: break
        hits.append(hex(j))
    print(name, hits)
