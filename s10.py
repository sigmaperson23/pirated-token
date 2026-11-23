import pefile, capstone
p=pefile.PE(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe')
d=open(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe','rb').read()
base=p.OPTIONAL_HEADER.ImageBase
def va2off(va):
    for s in p.sections:
        if s.VirtualAddress <= va-base < s.VirtualAddress+s.SizeOfRawData:
            return s.PointerToRawData+(va-base-s.VirtualAddress)
md=capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_64)
va=0x1400b67be; off=va2off(va)
back=0x1400b6600
for ins in md.disasm(d[va2off(back):off], back):
    if ins.mnemonic in ('push','int3','ret','sub'):
        print(hex(ins.address), ins.mnemonic, ins.op_str)
