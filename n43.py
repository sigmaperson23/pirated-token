import sys, struct, pefile
sys.stdout.reconfigure(encoding="utf-8")
p = pefile.PE(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe.orig")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe.orig", "rb").read()
B = p.OPTIONAL_HEADER.ImageBase
def v2o(va):
    for s in p.sections:
        if s.VirtualAddress <= va - B < s.VirtualAddress + s.SizeOfRawData:
            return s.PointerToRawData + (va - B - s.VirtualAddress)
# find exact 13-byte "schemaVersion" strings and see if preceded by a length qword
i = -1
while True:
    i = d.find(b"schemaVersion", i + 1)
    if i < 0: break
    print(hex(i), "prev8", d[i-8:i].hex(" "), "=> len", int.from_bytes(d[i-8:i], "little"))
