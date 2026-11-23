import pefile, capstone
p=pefile.PE(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe')
d=open(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe','rb').read()
base=p.OPTIONAL_HEADER.ImageBase
def va2off(va):
    for s in p.sections:
        if s.VirtualAddress <= va-base < s.VirtualAddress+s.SizeOfRawData:
            return s.PointerToRawData + (va-base-s.VirtualAddress)
md=capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_64)
d2=open(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe','rb').read()
va=0x1400b67be
off=va2off(va)
# look forward for interesting calls and string loads
for ins in md.disasm(d[off:off+700], va):
    tgt=''
    for op in ins.operands:
        if op.type==capstone.x86.X86_OP_MEM and op.mem.base==capstone.x86.X86_REG_RIP:
            a=ins.address+ins.size+op.mem.disp
            o2=va2off(a)
            if o2 and o2 < len(d2):
                s=d2[o2:o2+90].split(b'\x00')[0]
                if all(32<=c<127 for c in s) and len(s)>3: tgt=' ; '+s.decode()
    print(hex(ins.address), ins.mnemonic, ins.op_str, tgt)
