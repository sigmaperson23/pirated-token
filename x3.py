import pefile, capstone
p=pefile.PE(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe')
d=open(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe','rb').read()
base=p.OPTIONAL_HEADER.ImageBase
text=[s for s in p.sections if s.Name.startswith(b'.text')][0]
code=d[text.PointerToRawData:text.PointerToRawData+text.SizeOfRawData]
md=capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_64)
target=base+0xb6600
hits=[]
for ins in md.disasm(code, base+text.VirtualAddress):
    if ins.mnemonic in ('call','jmp') and ins.op_str.startswith('0x'):
        if int(ins.op_str,16)==target: hits.append(hex(ins.address))
print(hits)
