import pefile, capstone
p=pefile.PE(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe')
d=open(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe','rb').read()
base=p.OPTIONAL_HEADER.ImageBase
text=[s for s in p.sections if s.Name.startswith(b'.text')][0]
code=d[text.PointerToRawData:text.PointerToRawData+text.SizeOfRawData]
tva=base+text.VirtualAddress
targets={base+0x19b9b2f-0x400+0x400: 'FEATURES'}
# recompute properly: file offset 0x19b9b2f is in .text? no, .rdata starts 0x19ac000
def off2va(off):
    for s in p.sections:
        if s.PointerToRawData <= off < s.PointerToRawData + s.SizeOfRawData:
            return base + s.VirtualAddress + (off - s.PointerToRawData)
    return None
tg={}
for needle,name in [(b'bridgeVoicebridgeAssistantbridgeVerseremote','FEATURES'),(b'This feature needs a Pro or Ultra plan.','PROULTRA'),(b'entitlement_required','ENTREQ'),(b'BIZ_SUBSCRIPTION_REQUIRED','BIZ'),(b'/one/entitlement','EP')]:
    i=d.find(needle); tg[off2va(i)]=name
md=capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_64)
md.detail=True
hits=[]
for ins in md.disasm(code, tva):
    for op in ins.operands:
        if op.type==capstone.x86.X86_OP_MEM and op.mem.base==capstone.x86.X86_REG_RIP:
            a=ins.address+ins.size+op.mem.disp
            if a in tg:
                hits.append((tg[a], hex(ins.address), ins.mnemonic, ins.op_str))
for h in hits: print(h)
print('total',len(hits))
