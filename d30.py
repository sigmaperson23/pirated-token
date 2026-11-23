import sys, struct
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
# index all (ptr,len) pairs pointing at short identifiers
targets = {}
for name, off in [("schemaVersion", 0x19bffa9), ("userId", 0x19bffb6), ("verifiedAtUnixMs", 0x19bffbc), ("wasEntitled", 0x19bffcc)]:
    va = 0x140000000 + off
    pat = struct.pack("<Q", va)
    j = -1
    hits = []
    while True:
        j = d.find(pat, j + 1)
        if j < 0: break
        ln = struct.unpack_from("<Q", d, j + 8)[0]
        hits.append((j, ln))
    print(name, hex(va), hits)
