import brotli
d=open(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe','rb').read()
i=d.find(b'/assets/entitlements-Cv0g3vy-.js')
res=[]
for off in range(31200000, i+1):
    try:
        out=brotli.decompress(d[off:i])
    except Exception:
        continue
    if b'export' in out or b'function' in out:
        res.append((off,len(out),out[:60]))
for r in res[:5]: print(r)
print('total candidates',len(res))
if res:
    off=res[0][0]
    out=brotli.decompress(d[off:i])
    open('entitlements.js','wb').write(out)
    print('wrote',len(out))
