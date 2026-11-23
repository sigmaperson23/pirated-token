import sys, struct
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
def tab(off, n):
    for k in range(n):
        ln, ptr = struct.unpack_from("<QQ", d, off + k * 16)
        print(hex(off + k * 16), ln, hex(ptr), repr(d[ptr-0x140000000:ptr-0x140000000+ln]))
print("table 0x19d38f0")
tab(0x19d38f0, 6)
print("table 0x19d28b0")
tab(0x19d28b0, 6)
