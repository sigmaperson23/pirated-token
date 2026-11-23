import sys
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
for pat in [b"featurescredits", b"userIdtier", b"tierfeatures", b"verdict", b"limitscredits", b"monthlyAllowance", b"voiceConcurrency"]:
    i = d.find(pat)
    print("====", pat.decode(), hex(i) if i > 0 else "none")
    if i > 0:
        print(d[max(0,i-200):i+300].decode("latin1").replace("\x00","|"))
