import pefile, capstone
p=pefile.PE(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe')
d=open(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe','rb').read()
base=p.OPTIONAL_HEADER.ImageBase
target=0x1400b6600
md=capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_64)
for s in p.sections:
    if not (s.Characteristics & 0x20000000): continue
    data=d[s.PointerToRawData:s.PointerToRawData+s.SizeOfRawData]
    for ins in md.disasm(data, base+s.VirtualAddress):
        if ins.mnemonic=='call' and ins.op_str==hex(target):
            print(hex(ins.address))
