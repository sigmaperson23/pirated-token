import sys, re
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
seg = d[0x1a45c00:0x1a46200]
for p in re.findall(rb"[ -~]{4,200}", seg):
    print(p.decode("latin1"))
