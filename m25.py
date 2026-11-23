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
for a, b in [(0x1400b7366, 0x1400b7420), (0x1400b6efc, 0x1400b6f84), (0x1400b7076, 0x1400b7150)]:
    print("=====", hex(a))
    for ins in md.disasm(d[v2o(a):v2o(b)], a):
        print(hex(ins.address), ins.mnemonic, ins.op_str)
