import brotli,re,os
d=open(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe','rb').read()
os.makedirs('assets',exist_ok=True)
names=[m for m in re.finditer(rb'/assets/[A-Za-z0-9._\-]+\.(js|css|json|png|svg|woff2)',d)]
print('refs',len(names))
seen=set()
ok=0
for m in names:
    name=m.group(0).decode()
    if name in seen: continue
    seen.add(name)
    s=m.end()
    if s>=len(d): continue
    for end in range(s+20, min(s+900000, len(d))):
        try:
            out=brotli.decompress(d[s:end])
        except Exception:
            continue
        if len(out)<20: continue
        p='assets/'+name.split('/assets/')[-1]
        open(p,'wb').write(out)
        ok+=1
        break
print('extracted',ok)
