import sys, pefile
sys.stdout.reconfigure(encoding="utf-8")
p = pefile.PE(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
B = p.OPTIONAL_HEADER.ImageBase
def o2v(off):
    for s in p.sections:
        if s.PointerToRawData <= off < s.PointerToRawData + s.SizeOfRawData:
            return B + s.VirtualAddress + (off - s.PointerToRawData)
for name, off in [("schemaVersion", 0x19bffa9), ("userId", 0x19bffb6), ("verifiedAtUnixMs", 0x19bffbc), ("wasEntitled", 0x19bffcc), ("OneEntitlementData", 0x19d0d20), ("OneEntitlementResponse", 0x19d2928), ("Entitlements", 0x19d5508)]:
    print(name, hex(off), "->", hex(o2v(off)))
