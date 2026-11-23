import sys, struct
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe", "rb").read()
# interpret as pairs of (ptr,len) 8+4? print raw bytes for context
a = 0x19d38d0
print(repr(d[a:a+0x50]))
