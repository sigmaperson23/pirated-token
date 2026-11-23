import sys, pefile, capstone
sys.stdout.reconfigure(encoding="utf-8")
p = pefile.PE(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe.orig")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe.orig", "rb").read()
B = p.OPTIONAL_HEADER.ImageBase
def v2o(va):
    for s in p.sections:
        if s.VirtualAddress <= va - B < s.VirtualAddress + s.SizeOfRawData:
            return s.PointerToRawData + (va - B - s.VirtualAddress)
for a, n in [(0x1400b6dd0, 2), (0x1400b6e3c, 6), (0x1400b6e40, 2)]:
    print(hex(a), d[v2o(a):v2o(a)+n].hex(" "))
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_64)
for ins in md.disasm(d[v2o(0x1400b6dc6):v2o(0x1400b6de0)], 0x1400b6dc6):
    print(hex(ins.address), ins.mnemonic, ins.op_str)
