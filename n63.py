import sys, pefile, capstone
sys.stdout.reconfigure(encoding="utf-8")
code = bytes.fromhex("41b202e9fbfbffff9090")
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_64); md.detail = True
addr = 0x1400b7374
for ins in md.disasm(code, addr):
    print(hex(ins.address), ins.mnemonic, ins.op_str, "->", hex(ins.address + ins.size + (ins.operands[0].imm if ins.mnemonic == "jmp" else 0)))
print("ends at", hex(addr + len(code)))
