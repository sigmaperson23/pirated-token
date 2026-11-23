import sys, capstone
sys.stdout.reconfigure(encoding="utf-8")
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_64); md.detail = True
TGT = 0x1400B6F81
def build(src, tail):
    head = bytes([0x41, 0xB2, 0x02, 0xBD, 0x02, 0x00, 0x00, 0x00])   # 8 bytes
    jmp_at = src + len(head)
    rel = TGT - (jmp_at + 5)
    code = head + b"\xe9" + rel.to_bytes(4, "little", signed=True) + bytes([0x90]) * tail
    for ins in md.disasm(code, src):
        if ins.mnemonic == "jmp":
            t = ins.address + ins.size + ins.operands[0].imm
            print(hex(src), "len", len(code), "rel", rel, "land", hex(t), "OK" if t == TGT else "BAD")
    return code
p2 = build(0x1400B7374, 0)
p3 = build(0x1400B6D29, 1)
print(p2.hex(" "))
print(p3.hex(" "))
