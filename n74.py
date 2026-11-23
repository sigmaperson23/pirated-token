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
start = 0x140779f80
for ins in md.disasm(d[v2o(start):v2o(0x14077a030)], start):
    if ins.mnemonic.startswith(("cmp", "movzx", "test", "je", "jne", "ja", "jb", "jmp", "sub", "add")) or "byte ptr" in ins.op_str:
        print(hex(ins.address), ins.mnemonic, ins.op_str)
