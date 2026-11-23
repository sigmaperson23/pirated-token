import sys, struct
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
B = 0x140000000
def r(va, n):
    return d[va - B - 0x1000: va - B - 0x1000 + n]
i = d.find(b"struct OneEntitlementData with")
print("with-string at", hex(i), repr(d[i:i+60]))
# how many bytes follow as name pointer records
print(repr(d[i-60:i+60]))
print("---- table at 0x1419d1ceb")
for k in range(8):
    sp, sl = struct.unpack("<QQ", r(0x1419d1ceb + k*16, 16))
    print(k, hex(sp), sl, repr(r(sp, sl)) if 0 < sl < 40 else "")
