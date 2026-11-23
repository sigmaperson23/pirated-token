import sys, struct
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe.orig", "rb").read()
# find the (len,ptr) pair for that message, then locate its record
for ptr in range(0x19c0000, 0x1a40000, 8):
    pass
i = 0x1a3f631
va = i + 0x140001000
print("va", hex(va))
pat = struct.pack("<Q", va)
j = -1
hits = []
while True:
    j = d.find(pat, j + 1)
    if j < 0: break
    hits.append(hex(j - 8))
print(hits[:10])
