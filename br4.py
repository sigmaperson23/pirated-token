import brotli
d=open(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe','rb').read()
i=d.find(b'/assets/entitlements-Cv0g3vy-.js')
out=brotli.decompress(d[31266808:i])
open('entitlements.js','wb').write(out)
print(len(out))
t=out.decode('utf8','replace')
print(t[:1500])
