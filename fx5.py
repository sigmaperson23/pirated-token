NL = chr(10)
t = open("AGENTS.md", encoding="utf-8").read()
t = t.replace("  capture/raw.jsonl         request/response log from the study",
              "  capture/raw.jsonl         request/response log from the study" + NL +
              "  docs/dec.py               dump the DPAPI vault, prints tier and entitled")
open("AGENTS.md", "w", encoding="utf-8").write(t)
print("ok")
