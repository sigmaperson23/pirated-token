d=open(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe','rb').read()
i=-1; hits=[]
while True:
    i=d.find(b'api.bridgemind.ai', i+1)
    if i<0: break
    hits.append(i)
print(len(hits))
for h in hits[:20]: print(hex(h), repr(d[h-90:h+90]))
