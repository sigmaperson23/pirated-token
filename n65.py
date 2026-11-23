import sys
sys.stdout.reconfigure(encoding="utf-8")
# target must be 0x1400b6f7e (the 'mov r10, rbx' after the call). compute properly
src = 0x1400b7374
body_len = 3          # mov dl,2 ; jmp rel32
target = 0x1400b6f7e
rel = target - (src + body_len + 5)
print("rel", rel, hex(rel))
code = bytes([0xB2, 0x02, 0xE9]) + rel.to_bytes(4, "little", signed=True)
print(code.hex(" "))
import capstone
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_64); md.detail = True
for ins in md.disasm(code, src):
    t = ""
    if ins.mnemonic == "jmp": t = hex(ins.address + ins.size + ins.operands[0].imm)
    print(hex(ins.address), ins.mnemonic, ins.op_str, t)
