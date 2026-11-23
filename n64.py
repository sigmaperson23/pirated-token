import sys, pefile, capstone
sys.stdout.reconfigure(encoding="utf-8")
code = bytes.fromhex("b202e9fafbffff")
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_64)
for ins in md.disasm(code, 0x1400b7374):
    print(hex(ins.address), ins.mnemonic, ins.op_str)
print("len", len(code), "target should be", hex(0x1400b7374 + len(code) + int.from_bytes(code[-4:], "little", signed=True)))
