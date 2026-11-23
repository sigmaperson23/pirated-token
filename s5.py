import struct
d=open(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe','rb').read()
def show(base, back=12):
    print('===', hex(base))
    for k in range(1,back):
        off=base-k*16
        ptr,n=struct.unpack_from('<QQ',d,off)
        if 0x140000000<=ptr<=0x142000000 and 0<n<60:
            o=ptr-0x140000000
            print(k, repr(d[o:o+n]))
show(0x19d2928)
show(0x19d0d20)
