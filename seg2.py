import re
d=open(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe','rb').read()
for needle in [b'verdict', b'entitlement verdict', b'signature', b'ed25519']:
    i=d.find(needle)
    print(needle, hex(i) if i>0 else i)
# list strings containing entitle in whole binary
for m in re.finditer(rb'[ -~]{8,}', d):
    s=m.group(0)
    if b'entitle' in s.lower() and len(s)<300:
        print(hex(m.start()), s.decode('ascii','replace'))
