import sys, re, json
sys.stdout.reconfigure(encoding="utf-8")
d = open(r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe.orig", "rb").read()
i = d.find(b"Offline evidence requires a live entitlement verdict.")
print(hex(i), repr(d[max(0,i-200):i+200]))
