import sys, capstone
sys.stdout.reconfigure(encoding="utf-8")
src = 0x1400b7374
target = 0x1400b6f7e
rel = target - (src + 7)
print("rel", rel, hex(rel))
code = bytes([0xB2, 0x02, 0xE9]) + rel.to_bytes(4, "little", signed=True)
print(code.hex(" "), len(code))
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_64); md.detail = True
for ins in md.disasm(code, src):
    t = hex(ins.address + ins.size + ins.operands[0].imm) if ins.mnemonic == "jmp" else ""
    print(hex(ins.address), ins.mnemonic, ins.op_str, t)
