import struct
d=open(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe','rb').read()
def deref(p):
    # ptr appears to be full VA in 0x141xxxxxx range
    import pefile
    return p
for base in [0x19d0d20,0x19d2928,0x19d5508]:
    print('===',hex(base))
    for k in range(1,10):
        off=base-k*16
        ptr,n=struct.unpack_from('<QQ',d,off)
        if 0x141000000<=ptr<=0x142000000:
            o=ptr-0x140000000
            s=d[o:o+n] if o<len(d) else b''
            print(k, hex(ptr), n, repr(s[:40]))
