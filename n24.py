import sys, pefile, capstone
sys.stdout.reconfigure(encoding="utf-8")
p = pefile.PE(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
B = p.OPTIONAL_HEADER.ImageBase
def v2o(va):
    for s in p.sections:
        if s.VirtualAddress <= va - B < s.VirtualAddress + s.SizeOfRawData:
            return s.PointerToRawData + (va - B - s.VirtualAddress)
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_64); md.detail = True
start = 0x1410484c0
for ins in md.disasm(d[v2o(start):v2o(start)+0x500], start):
    ex = ""
    try:
        for op in ins.operands:
            if op.type == capstone.x86.X86_OP_MEM and op.mem.base == capstone.x86.X86_REG_RIP:
                a = ins.address + ins.size + op.mem.disp
                o = v2o(a)
                if o: ex = " ; " + repr(d[o:o+45])
            if op.type == capstone.x86.X86_OP_IMM and ins.mnemonic in ("cmp","mov"):
                o = v2o(op.imm)
                if o: ex = " ; imm->" + repr(d[o:o+45])
    except Exception: pass
    print(hex(ins.address), ins.mnemonic, ins.op_str, ex)
