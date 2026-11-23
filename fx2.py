NL = chr(10)
t = open("README.md", encoding="utf-8").read()
t = t.replace(
 "patch.py refuses any" + NL + "other hash and prints the exact bytes it wants, so a rebuilt binary fails loudly instead of silently corrupting.",
 "patch.py refuses any other hash and prints" + NL + "the exact bytes it wants, so a rebuilt binary fails loudly instead of corrupting it.")
t = t.replace("VERIFICATION CHECKLIST, all pass on route A", "VERIFICATION CHECKLIST, all pass on route A + B")
open("README.md", "w", encoding="utf-8").write(t)
print("ok")
