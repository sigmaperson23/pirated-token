import sys, capstone
sys.stdout.reconfigure(encoding="utf-8")
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_64); md.detail = True

# patch 2: va 0x1400b7374, 13 bytes, target 0x1400b6f81 from end 0x1400b7381
src = 0x1400B7374
tgt = 0x1400B6F81
rel = tgt - (src + 13)
p2 = bytes([0x41, 0xB2, 0x02, 0xBD, 0x02, 0x00, 0x00, 0x00, 0xE9]) + rel.to_bytes(4, "little", signed=True)
print("p2", p2.hex(" "), len(p2))

# patch 3: va 0x1400b6d29, 14 bytes
src3 = 0x1400B6D29
rel3 = tgt - (src3 + 14)
p3 = bytes([0x41, 0xB2, 0x02, 0xBD, 0x02, 0x00, 0x00, 0x00, 0xE9]) + rel3.to_bytes(4, "little", signed=True) + bytes([0x90])
print("p3", p3.hex(" "), len(p3))
for code, s in ((p2, src), (p3, src3)):
    for ins in md.disasm(code, s):
        t = hex(ins.address + ins.size + ins.operands[0].imm) if ins.mnemonic == "jmp" else ""
        print("  ", hex(ins.address), ins.mnemonic, ins.op_str, t)
