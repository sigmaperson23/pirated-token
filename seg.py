import re
d=open(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe','rb').read()
seg=d[0x19bf800:0x19c3400]
parts=re.findall(rb'[ -~]{6,}', seg)
for p in parts:
    print(p.decode())
