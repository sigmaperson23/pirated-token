import sys, pefile
sys.stdout.reconfigure(encoding="utf-8")
p = pefile.PE(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe.orig")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe.orig", "rb").read()
B = p.OPTIONAL_HEADER.ImageBase
for s in p.sections:
    if s.VirtualAddress <= 0x1400b6d29 - B < s.VirtualAddress + s.SizeOfRawData:
        o = s.PointerToRawData + (0x1400b6d29 - B - s.VirtualAddress)
print("off", hex(o), d[o:o+14].hex(" "))
src = 0x1400b6d29
body = bytes([0x41, 0xB2, 0x02, 0xE9])
rel = 0x1400b6f81 - (src + 8)
print("rel", hex(rel), rel)
new = body + rel.to_bytes(4, "little", signed=True) + bytes([0x90] * 6)
print("new", new.hex(" "), len(new))
import capstone
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_64); md.detail = True
for ins in md.disasm(new, src):
    t = hex(ins.address + ins.size + ins.operands[0].imm) if ins.mnemonic == "jmp" else ""
    print(hex(ins.address), ins.mnemonic, ins.op_str, t)
