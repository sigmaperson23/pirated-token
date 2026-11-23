import sys, capstone
sys.stdout.reconfigure(encoding="utf-8")
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_64); md.detail = True
TGT = 0x1400B6F81
def build(src, tail):
    body = bytes([0x41, 0xB2, 0x02, 0xBD, 0x02, 0x00, 0x00, 0x00, 0xE9])
    jmp_at = src + len(body)
    rel = TGT - (jmp_at + 5)
    code = body + rel.to_bytes(4, "little", signed=True) + bytes([0x90]) * tail
    for ins in md.disasm(code, src):
        if ins.mnemonic == "jmp":
            t = ins.address + ins.size + ins.operands[0].imm
            print(hex(src), "len", len(code), "rel", rel, "->", hex(t), t == TGT)
    return code
build(0x1400B7374, 0)
build(0x1400B6D29, 1)
