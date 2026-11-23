import sys, json
sys.stdout.reconfigure(encoding="utf-8")
o = json.load(open(r"C:\Users\sixth\AppData\Local\Temp\live_auth.json"))
print("tier", o["user"]["subscriptionTier"])
print("evidence", o["entitlement_evidence"]["wasEntitled"])
