import json, os
from mitmproxy import http
HERE = os.path.dirname(os.path.abspath(__file__))
BODY = open(os.path.join(HERE, "capture", "payload.json"), encoding="utf-8").read()

def paidize(o):
    o["user"]["subscriptionTier"] = "pro"
    s = o["subscription"]
    s.update(tier="pro", paymentStatus="active", hasAccess=True, status="active", cancelAtPeriodEnd=False)
    e = o["entitlements"]
    for k in ("bridgeSpace", "voice", "apiKeys", "bridgeAgent", "bridgemindOne"):
        e[k] = True
    e["tier"] = "pro"
    for k in e["features"]:
        e["features"][k] = True
    e["credits"]["monthlyAllowance"] = 5000
    e["limits"].update(voiceConcurrency=3, dailyTranscriptions=500, dailyPolish=500)
    return o

def response(flow):
    p = flow.request.path
    if p.startswith("/one/entitlement"):
        flow.response.status_code = 200
        flow.response.headers["content-type"] = "application/json"
        flow.response.text = BODY
    elif p == "/auth/me" and flow.response.status_code == 200:
        flow.response.text = json.dumps(paidize(json.loads(flow.response.text)))
