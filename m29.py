import sys, pefile, capstone
sys.stdout.reconfigure(encoding="utf-8")
p = pefile.PE(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
B = p.OPTIONAL_HEADER.ImageBase
def v2o(va):
    for s in p.sections:
        if s.VirtualAddress <= va - B < s.VirtualAddress + s.SizeOfRawData:
            return s.PointerToRawData + (va - B - s.VirtualAddress)
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_64)
for a, b in [(0x1400b6dcc, 0x1400b6de0), (0x1400b6e60, 0x1400b6e70), (0x1400b6e9c, 0x1400b6ed8)]:
    print("=====", hex(a))
    for ins in md.disasm(d[v2o(a):v2o(b)], a):
        print(hex(ins.address), ins.mnemonic, ins.op_str)
