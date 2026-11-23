import brotli
d=open(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe','rb').read()
name=b'/assets/entitlements-Cv0g3vy-.js'
i=d.find(name); s=i+len(name)
for end in range(s+50, s+200000):
    try:
        out=brotli.decompress(d[s:end])
    except Exception:
        continue
    print('ok', end, len(out)); open('ent.js','wb').write(out); break
