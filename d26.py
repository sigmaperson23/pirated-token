import sys, struct
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
for off in range(0x19d38d8, 0x19d3948, 16):
    ptr, ln = struct.unpack_from("<QQ", d, off)
    s = d[ptr-0x140000000:ptr-0x140000000+ln] if 0x141000000 <= ptr < 0x142000000 and 0 < ln < 64 else b""
    print(hex(off), ln, repr(s))
print("--- raw region of strings")
print(repr(d[0x19d48c0:0x19d4940]))
