import brotli
d=open(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe','rb').read()
i=d.find(b'/assets/entitlements-Cv0g3vy-.js')
print(i)
print(d[i-80:i].hex())
# find brotli magic-ish: try decompress ending exactly at i
best=None
for off in range(max(0,i-300000), i):
    try:
        out=brotli.decompress(d[off:i])
        if b'entitlement' in out.lower():
            print('exact', off, len(out)); best=(off,out); break
    except Exception as e:
        pass
if best is None: print('none')
