import pefile,capstone
p=pefile.PE(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe')
d=open(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe','rb').read()
base=p.OPTIONAL_HEADER.ImageBase
def va2off(va):
    for s in p.sections:
        if s.VirtualAddress<=va-base<s.VirtualAddress+s.SizeOfRawData:
            return s.PointerToRawData+(va-base-s.VirtualAddress)
md=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_64); md.detail=True
start,end=0x140779f80,0x14077a360
for ins in md.disasm(d[va2off(start):va2off(end)],start):
    tgt=''
    try:
        for op in ins.operands:
            if op.type==capstone.x86.X86_OP_MEM and op.mem.base==capstone.x86.X86_REG_RIP:
                a=ins.address+ins.size+op.mem.disp
                o2=va2off(a)
                if o2:
                    s=d[o2:o2+60].split(b'\x00')[0]
                    if s and all(32<=c<127 for c in s): tgt=' ; '+s.decode()
    except Exception: pass
    print(hex(ins.address), ins.mnemonic, ins.op_str, tgt)
