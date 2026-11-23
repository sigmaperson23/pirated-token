import json
d = json.load(open(r"C:\Users\sixth\Desktop\Claude\Playground\switchyard\capture\raw.jsonl", encoding="utf-8")) if False else None
recs = [json.loads(l) for l in open(r"C:\Users\sixth\Desktop\Claude\Playground\switchyard\capture\raw.jsonl", encoding="utf-8")]
keep = [r for r in recs if r.get("phase") in ("req", "resp", "rewrote", "rw_ent", "rw_me", "rewrite")]
with open(r"C:\Users\sixth\Desktop\Claude\Playground\switchyard\capture\raw.jsonl", "w", encoding="utf-8") as f:
    for r in keep:
        f.write(json.dumps(r) + "
")
print(len(keep))
