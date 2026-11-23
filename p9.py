import capstone
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_64); md.detail = True
TGT = 0x1400B6F81
head = bytes([0x41, 0xB2, 0x02, 0xBD, 0x04, 0x00, 0x00, 0x00])  # mov r10b,2 ; mov ebp,4
def build(src, tail):
    jmp_at = src + len(head)
    rel = TGT - (jmp_at + 5)
    code = head + b"\xe9" + rel.to_bytes(4, "little", signed=True) + bytes([0x90]) * tail
    assert len(code) in (13, 14)
    for ins in md.disasm(code, src):
        if ins.mnemonic == "jmp":
            land = ins.address + ins.size + ins.operands[0].imm
            print(hex(src), "len", len(code), "land", hex(land), "OK" if land == TGT else "BAD")
    return code
print(build(0x1400B7374, 0).hex(" "))
print(build(0x1400B6D29, 1).hex(" "))
