import sys, pefile, capstone
sys.stdout.reconfigure(encoding="utf-8")
p = pefile.PE(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe.orig")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe.orig", "rb").read()
B = p.OPTIONAL_HEADER.ImageBase
def v2o(va):
    for s in p.sections:
        if s.VirtualAddress <= va - B < s.VirtualAddress + s.SizeOfRawData:
            return s.PointerToRawData + (va - B - s.VirtualAddress)
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_64)
for ins in md.disasm(d[v2o(0x1400b6d10):v2o(0x1400b6d40)], 0x1400b6d10):
    print(hex(ins.address), ins.mnemonic, ins.op_str)
print("--- call at 6d0d goes where")
for ins in md.disasm(d[v2o(0x140568990):v2o(0x1405689d0)], 0x140568990):
    print(hex(ins.address), ins.mnemonic, ins.op_str)
