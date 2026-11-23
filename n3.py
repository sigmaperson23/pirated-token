import json, sys
sys.stdout.reconfigure(encoding="utf-8")
for line in open(r"capture\raw.jsonl", encoding="utf-8"):
    o = json.loads(line)
    print(o["phase"], o.get("method"), o.get("url"), o.get("status",""))
