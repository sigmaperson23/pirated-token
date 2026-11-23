import pefile, capstone
p=pefile.PE(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe')
d=open(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe','rb').read()
base=p.OPTIONAL_HEADER.ImageBase
def va2off(va):
    for s in p.sections:
        if s.VirtualAddress <= va-base < s.VirtualAddress+s.SizeOfRawData:
            return s.PointerToRawData + (va-base-s.VirtualAddress)
md=capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_64)
for va in [0x1410958b3,0x1410c7cb9,0x14112af70,0x141152c5b]:
    off=va2off(va)
    start=off-120
    print(hex(va))
    for ins in md.disasm(d[start:off+160], va-120):
        print(' ', hex(ins.address), ins.mnemonic, ins.op_str)
    print('=====')
