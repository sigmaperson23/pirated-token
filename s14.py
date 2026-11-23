d=open(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe','rb').read()
import re
for m in re.finditer(rb'[ -~]{5,}', d[0x19b8000:0x19bb000]):
    s=m.group(0)
    if s in (b'tier',b'features',b'includedCredits',b'entitlements',b'hasAccess') or b'tier' in s:
        print(hex(0x19b8000+m.start()), s.decode())
