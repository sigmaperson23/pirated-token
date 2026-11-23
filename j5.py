import sys, re
sys.stdout.reconfigure(encoding="utf-8")
t = open("assets/core-D2hsf8Rz.js", encoding="utf-8").read()
for pat in ("Pick a plan to open", "doesn't include BridgeMind"):
    i = t.find(pat)
    print("=====", pat, i)
    print(t[max(0,i-700):i+400])
