import re
d=open(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe','rb').read()
# find all ASCII strings mentioning 'entitlement' in the rust source refs, plus any '.rs' near auth
for m in re.finditer(rb'src\\app\\[a-z_\\]+\.rs', d):
    print(hex(m.start()), m.group(0).decode())
