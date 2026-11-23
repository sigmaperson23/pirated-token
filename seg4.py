d=open(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe','rb').read()
import re
# search field-name clusters around entitlement structs
for m in re.finditer(rb'[ -~]{4,}', d[0x19c0000:0x19e0000]):
    s=m.group(0)
    if b'ntitle' in s or b'tier' in s.lower() or b'features' in s or b'bridgemindOne' in s:
        print(hex(0x19c0000+m.start()), s.decode())
