import re
d=open(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe','rb').read()
for off in [0x19d0d20,0x1e1f6a0,0x1e1f310,0x19d2928]:
    print('===',hex(off))
    print(re.sub(rb'[^\x20-\x7e]+',b'|',d[off-320:off+80]).decode())
