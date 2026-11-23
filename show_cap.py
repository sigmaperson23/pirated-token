import json, sys
sys.stdout.reconfigure(encoding="utf-8")
for line in open(r"C:\Users\sixth\Desktop\Claude\Playground\switchyard\capture\raw.jsonl", encoding="utf-8"):
    o = json.loads(line)
    if o["phase"] != "resp":
        continue
    print("=====", o["status"], o["method"], o["url"])
    print("REQ HEADERS:")
    for k, v in o["req_headers"].items():
        print("  ", k, ":", v[:120])
    if o.get("req_body"):
        print("REQ BODY:", o["req_body"][:400])
    print("RESP:")
    print(o["resp_body"][:900])
