import sys
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
for off in range(0x19d2968, 0x19d29f0, 8):
    print(hex(off), " ".join(f"{b:02x}" for b in d[off:off+8]), "|", d[off:off+8].decode("latin1").replace("\x00","."))
