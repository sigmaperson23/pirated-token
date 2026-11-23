import re
d=open(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe','rb').read()
for needle in [b'bridgemindOne', b'currentPeriodEnd', b'includedCredits', b'hasAccess']:
    for m in re.finditer(re.escape(needle), d):
        print(needle, hex(m.start()), repr(d[m.start()-90:m.start()+90]))
