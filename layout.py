d=open(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe','rb').read()
i=d.find(b'/assets/entitlements-Cv0g3vy-.js')
print(hex(i))
print(repr(d[i-260:i+40]))
