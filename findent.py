import sys, re
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
for m in re.finditer(rb"OneEntitlement\w*", d):
    i = m.start()
    print(hex(i), d[max(0,i-40):i+180].decode("latin1").replace("\x00","|"))
    print("---")
