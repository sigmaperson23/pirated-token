import sys
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
for off in range(0x19d2900, 0x19d2980, 16):
    print(hex(off), " ".join(f"{b:02x}" for b in d[off:off+16]), "|", d[off:off+16].decode("latin1").replace("\x00","."))
