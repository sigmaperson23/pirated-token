import pefile
p=pefile.PE(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe')
d=open(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe','rb').read()
def off2va(off):
    for s in p.sections:
        if s.PointerToRawData <= off < s.PointerToRawData + s.SizeOfRawData:
            return p.OPTIONAL_HEADER.ImageBase + s.VirtualAddress + (off - s.PointerToRawData)
    return None
for needle in [b'bridgeVoicebridgeAssistantbridgeVerseremote', b'This feature needs a Pro or Ultra plan.', b'entitlement_required', b'/one/entitlement', b'BIZ_SUBSCRIPTION_REQUIRED']:
    i=d.find(needle)
    print(needle[:40], hex(i) if i>0 else i, hex(off2va(i)) if i>0 else '')
