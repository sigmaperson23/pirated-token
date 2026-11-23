import sys, capstone
sys.stdout.reconfigure(encoding="utf-8")
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_64); md.detail = True
TGT = 0x1400B6F81
def build(src, tail):
    body = bytes([0x41, 0xB2, 0x02, 0xBD, 0x02, 0x00, 0x00, 0x00, 0xE9])
    total = len(body) + 4 + tail
    rel = TGT - (src + total)
    code = body + rel.to_bytes(4, "little", signed=True) + bytes([0x90]) * tail
    ok = True
    for ins in md.disasm(code, src):
        if ins.mnemonic == "jmp":
            t = ins.address + ins.size + ins.operands[0].imm
            ok = t == TGT
            print("  ", hex(src), code.hex(" "), "->", hex(t), "OK" if ok else "BAD")
    return code
p2 = build(0x1400B7374, 0)
p3 = build(0x1400B6D29, 1)
print(repr(p2.hex(" ")), repr(p3.hex(" ")))
