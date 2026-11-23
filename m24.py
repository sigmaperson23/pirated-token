import sys
sys.stdout.reconfigure(encoding="utf-8")
t = open("d_ent3.txt", encoding="utf-8").read().splitlines()
for i, line in enumerate(t):
    if line.startswith("0x1400b6f81") or "0x1400b6f" in line[:12] or "0x1400b70" in line[:12]:
        print("\n".join(t[i:i+60]))
        break
