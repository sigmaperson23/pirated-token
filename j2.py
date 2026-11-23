import sys, re
sys.stdout.reconfigure(encoding="utf-8")
t = open("assets/core-D2hsf8Rz.js", encoding="utf-8").read()
for m in re.finditer("access\.kind|monthlyAllowance|hasAccess", t):
    print("---", m.group(), m.start())
    print(t[max(0,m.start()-350):m.start()+350].replace("\n"," "))
