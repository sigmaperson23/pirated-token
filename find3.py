d=open(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe','rb').read()
i=0x19bffcc
print(d[i-120:i+260].decode('utf8','replace'))
print('=====')
j=0x1a08e7d
print(d[j-200:j+200].decode('utf8','replace'))
print('=====')
k=0x1a3f5d0
print(d[k:k+700].decode('utf8','replace'))
