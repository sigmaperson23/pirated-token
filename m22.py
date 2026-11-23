import sys, capstone, pefile
sys.stdout.reconfigure(encoding="utf-8")
p = pefile.PE(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
B = p.OPTIONAL_HEADER.ImageBase
def v2o(va):
    for s in p.sections:
        if s.VirtualAddress <= va - B < s.VirtualAddress + s.SizeOfRawData:
            return s.PointerToRawData + (va - B - s.VirtualAddress)
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_64); md.detail = True
# find calls to 0x1400b6600
target = 0x1400b6600
txt = [s for s in p.sections if s.Name.startswith(b".text")][0]
code = d[txt.PointerToRawData: txt.PointerToRawData + txt.SizeOfRawData]
base_va = B + txt.VirtualAddress
hits = []
for ins in md.disasm(code, base_va):
    if ins.mnemonic == "call":
        try:
            if ins.operands[0].type == capstone.x86.X86_OP_IMM and ins.operands[0].imm == target:
                hits.append(ins.address)
        except Exception: pass
print(len(hits), [hex(h) for h in hits[:10]])
