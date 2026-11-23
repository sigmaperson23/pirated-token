import json, time
uid = "65d29a8d-52a6-4c9e-869b-2083c185f3fe"
data = {"schemaVersion": 2, "userId": uid, "verifiedAtUnixMs": int(time.time()*1000),
        "wasEntitled": True,
        "features": {"bridgeVoice": True, "bridgeAssistant": True, "bridgeVerse": True, "remote": True}}
open(r"capture\payload.json","w").write(json.dumps({"entitlement": "bridgemindOne", "data": data}))
print(open(r"capture\payload.json").read())
