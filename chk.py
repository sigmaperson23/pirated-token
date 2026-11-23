import sys, pefile
d = bytearray(open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read())
P = [
    (0x1400B6FCA, "C6460802", "44885608"),
    (0x1400B7374, "41B202BD04000000E900FCFFFF", "BD02000000E903FCFFFF"),
    (0x1400B6D29, "41B202BD04000000E94B02000090", "48C70605000000B004E91D030000"),
]
pe = pefile.PE(data=bytes(d), fast_load=True)
B = pe.OPTIONAL_HEADER.ImageBase
def v2o(va):
    for s in pe.sections:
        if s.VirtualAddress <= va - B < s.VirtualAddress + s.SizeOfRawData:
            return s.PointerToRawData + (va - B - s.VirtualAddress)
for va, cur, _ in P:
    o = v2o(va)
    print(hex(va), "cur", d[o:o+len(cur)//2].hex(" "))
