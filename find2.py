d=open(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe','rb').read()
for needle in [b'wasEntitled', b'features_lost', b'entitlement_lost', b'restoring', b'Offline evidence requires']:
    idx=[]; i=d.find(needle)
    while i>=0 and len(idx)<6:
        idx.append(i); i=d.find(needle,i+1)
    print(needle, [hex(x) for x in idx])
