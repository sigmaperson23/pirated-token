import sys
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
a=0x19d2920; b=0x19d2b40
for off in range(a,b,16):
    print(hex(off), d[off:off+16].decode("latin1").replace("\x00","."))
