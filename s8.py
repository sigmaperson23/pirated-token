import re
d=open(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe','rb').read()
seg=d[0x19d0b80:0x19d0f00]
print(re.sub(rb'[^\x20-\x7e]+', b'|', seg).decode())
print('==========')
seg2=d[0x19d2800:0x19d2b00]
print(re.sub(rb'[^\x20-\x7e]+', b'|', seg2).decode())
