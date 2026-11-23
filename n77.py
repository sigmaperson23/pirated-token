import sys, capstone
sys.stdout.reconfigure(encoding="utf-8")
src = 0x1400B6D29
tgt = 0x1400B6F81
body = bytes([0x41, 0xB2, 0x02, 0xBD, 0x02, 0x00, 0x00, 0x00, 0xE9])
jmp_va = src + len(body)
rel = tgt - (jmp_va + 5)
code = body + rel.to_bytes(4, "little", signed=True) + bytes([0x90])
print("rel", hex(rel), "len", len(code), "end", hex(src + len(code)))
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_64); md.detail = True
for ins in md.disasm(code, src):
    t = hex(ins.address + ins.size + ins.operands[0].imm) if ins.mnemonic == "jmp" else ""
    print(hex(ins.address), ins.mnemonic, ins.op_str, t)
