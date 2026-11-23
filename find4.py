d=open(r'C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe','rb').read()
i=0x19bffcc
print(repr(d[i-160:i+300]))
print('=====')
j=0x1a08e7d
print(repr(d[j-260:j+200]))
print('=====')
k=0x1a3f5d0
print(repr(d[k:k+760]))
