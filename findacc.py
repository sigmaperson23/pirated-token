import pefile, capstone
p=pefile.PE(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe')
d=open(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe','rb').read()
base=p.OPTIONAL_HEADER.ImageBase
targets={0x141a46ef6:'basic',0x141a46f02:'upgradeRequired',0x141a46f0d:'unverified',0x141a46da4:'entitled',0x141a46f10:'verified?'}
md=capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_64); md.detail=True
for s in p.sections:
    if not (s.Characteristics & 0x20000000): continue
    data=d[s.PointerToRawData:s.PointerToRawData+s.SizeOfRawData]
    start=base+s.VirtualAddress
    for ins in md.disasm(data,start):
        try:
            for op in ins.operands:
                if op.type==capstone.x86.X86_OP_MEM and op.mem.base==capstone.x86.X86_REG_RIP:
                    a=ins.address+ins.size+op.mem.disp
                    if a in targets: print(targets[a], hex(ins.address), ins.mnemonic, ins.op_str)
        except Exception: pass
