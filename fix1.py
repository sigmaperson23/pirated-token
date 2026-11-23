p = "run.ps1"
t = open(p, encoding="utf-8").read()
t = t.replace("$addon = 'C:\\Users\\sixth\\Desktop\\Claude\\Playground\\switchyard\\addon.py'",
              "$addon = 'C:\\Users\\sixth\\Desktop\\Claude\\Playground\\switchyard\\addon.py'" + chr(10) + "$log   = 'C:\\Users\\sixth\\Desktop\\Claude\\Playground\\switchyard\\capture\\run.log'")
open(p, "w", encoding="utf-8").write(t)
print([l for l in t.split(chr(10)) if "log" in l][:3])
