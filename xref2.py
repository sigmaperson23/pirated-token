import pefile, capstone
p=pefile.PE(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe')
d=open(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe','rb').read()
base=p.OPTIONAL_HEADER.ImageBase
def off2va(off):
    for s in p.sections:
        if s.PointerToRawData <= off < s.PointerToRawData+s.SizeOfRawData:
            return base+s.VirtualAddress+(off-s.PointerToRawData)
def va2off(va):
    for s in p.sections:
        if s.VirtualAddress <= va-base < s.VirtualAddress+s.SizeOfRawData:
            return s.PointerToRawData+(va-base-s.VirtualAddress)
targets={off2va(0x1a34a10):'APIHOST', off2va(0x19c21c8):'EP'}
text=[s for s in p.sections if s.Name.startswith(b'.text')][0]
code=d[text.PointerToRawData:text.PointerToRawData+text.SizeOfRawData]
md=capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_64); md.detail=True
for ins in md.disasm(code, base+text.VirtualAddress):
    for op in ins.operands:
        if op.type==capstone.x86.X86_OP_MEM and op.mem.base==capstone.x86.X86_REG_RIP:
            a=ins.address+ins.size+op.mem.disp
            if a in targets: print(targets[a], hex(ins.address), ins.mnemonic, ins.op_str)
