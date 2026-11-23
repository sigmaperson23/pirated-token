import sys, re
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
seg = d[0x19c1f80:0x19c2600]
for p in re.findall(rb"[ -~]{3,80}", seg):
    print(p.decode("latin1"))
