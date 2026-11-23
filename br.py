import brotli
d=open(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe','rb').read()
key=b'/assets/entitlements-Cv0g3vy-.js'
i=d.find(key)
print('key at',i)
lo=max(0,i-400000)
hits=[]
for off in range(lo,i):
    if not d[off:off+4].isascii(): pass
    try:
        out=brotli.decompress(d[off:off+400000])
        if b'entitlement' in out.lower() or b'bridgemind' in out.lower():
            hits.append((off,len(out)))
    except Exception:
        pass
print(hits[:10])
