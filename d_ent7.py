import pefile, capstone
p=pefile.PE(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe')
d=open(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe','rb').read()
base=p.OPTIONAL_HEADER.ImageBase
def va2off(va):
    for s in p.sections:
        if s.VirtualAddress <= va-base < s.VirtualAddress+s.SizeOfRawData:
            return s.PointerToRawData+(va-base-s.VirtualAddress)
md=capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_64); md.detail=True
start=0x1400b75b0; end=0x1400b7870
for ins in md.disasm(d[va2off(start):va2off(end)], start):
    tgt=''
    try:
        for op in ins.operands:
            if op.type==capstone.x86.X86_OP_IMM:
                v=op.imm
                if 0x140000000<=v<0x142000000:
                    o2=va2off(v)
                    if o2:
                        s2=d[o2:o2+40].split(b'\x00')[0]
                        if s2 and all(32<=c<127 for c in s2): tgt=' ; -> '+s2.decode()
    except Exception: pass
    print(hex(ins.address), ins.mnemonic, ins.op_str, tgt)
