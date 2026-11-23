import sys, re
sys.stdout.reconfigure(encoding="utf-8")
t = open("assets/index-BRXgRmQX.js", encoding="utf-8").read()
for m in re.finditer("entitled", t):
    print("---", m.start())
    print(t[max(0,m.start()-500):m.start()+500])
