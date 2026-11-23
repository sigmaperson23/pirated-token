# verify the produced bytes land correctly when read back from a buffer
import capstone
p2 = bytes.fromhex("41B202BD04000000E900FCFFFF")
p3 = bytes.fromhex("41B202BD04000000E94B02000090")
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_64); md.detail = True
for code, src in ((p2, 0x1400B7374), (p3, 0x1400B6D29)):
    for ins in md.disasm(code, src):
        if ins.mnemonic == "jmp":
            print(hex(ins.address), "target", hex(ins.address + ins.size + ins.operands[0].imm))
