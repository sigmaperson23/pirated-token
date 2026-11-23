import pefile, struct
p=pefile.PE(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe')
d=open(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe','rb').read()
base=p.OPTIONAL_HEADER.ImageBase
def off2va(off):
    for s in p.sections:
        if s.PointerToRawData <= off < s.PointerToRawData+s.SizeOfRawData:
            return base+s.VirtualAddress+(off-s.PointerToRawData)
for name,off in [('offlineevid',0x1a3f610),('reqrequired',0x1a45d08+0),('BIZ',0x19c2208)]:
    va=off2va(off)
    print(name,hex(off),hex(va) if va else None)
    for pat in (struct.pack('<Q',va), struct.pack('<i',va-0x140000000)):
        pass
