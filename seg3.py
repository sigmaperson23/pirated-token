d=open(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe','rb').read()
import re
for off in [0x19d0d20,0x19d2928,0x19d5508,0x1e1f310,0x1e1f6a0,0x1e20678]:
    print(hex(off))
    print(repr(d[off-120:off+400]))
    print('---')
