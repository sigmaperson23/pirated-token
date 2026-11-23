import sys, struct
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe.orig", "rb").read()
i = d.find(b"Offline evidence requires")
print("file off", hex(i))
seq = d[i-120:i+20]
for k in range(0, len(seq) - 8, 8):
    v = struct.unpack_from("<Q", d, i - 120 + k)[0]
    t = ""
    if 0x141000000 <= v < 0x142000000:
        o = v - 0x140001000
        t = repr(d[o:o+30])
    print(hex(i - 120 + k), hex(v), t)
