import brotli
d=open(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe','rb').read()
i=d.find(b'/assets/entitlements-Cv0g3vy-.js')
start=d.rfind(b'/bundle-report.json',0,i)+len(b'/bundle-report.json')
print('start',start,'end',i,'len',i-start)
out=brotli.decompress(d[start:i])
open('ent.js','wb').write(out)
print(len(out)); print(out[:400])
