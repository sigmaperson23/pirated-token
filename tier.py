import pefile, struct
p=pefile.PE(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe')
d=open(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe','rb').read()
base=p.OPTIONAL_HEADER.ImageBase
def off2va(off):
    for s in p.sections:
        if s.PointerToRawData <= off < s.PointerToRawData+s.SizeOfRawData:
            return base+s.VirtualAddress+(off-s.PointerToRawData)
idx=0
while True:
    i=d.find(b'tier',idx)
    if i<0: break
    idx=i+1
    if d[i-1:i]==b'\x00' or True:
        va=off2va(i)
        if va:
            refs=[]
            pat=struct.pack('<Q',va)
            j=-1
            while True:
                j=d.find(pat,j+1)
                if j<0: break
                refs.append(j)
            if refs:
                print(hex(i),hex(va),repr(d[i-30:i+40]),[hex(r) for r in refs[:6]])
