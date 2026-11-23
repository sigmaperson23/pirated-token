"""mitmproxy addon for the BridgeMind One entitlement gate.

Only api.bridgemind.ai is intercepted (see allow_hosts in run.ps1); everything
else is tunnelled untouched so AWS, sentry, downloads and the updater keep their
real certificates. Both rewritten endpoints are rewritten on the path, never on
the status, because the 403 body is what has to be replaced.
"""

import json
import os
import time

from mitmproxy import ctx, http

HERE = os.path.dirname(os.path.abspath(__file__))
PAYLOAD = os.path.join(HERE, "capture", "entitlement.json")

ACCOUNT_ID = "65d29a8d-52a6-4c9e-869b-2083c185f3fe"
API_HOST = "api.bridgemind.ai"

_payload_cache = (0.0, None)


def load_payload() -> str:
    """Render the entitlement template, reloading it only when the file changes."""
    global _payload_cache
    mtime = os.path.getmtime(PAYLOAD)
    if _payload_cache[1] is None or mtime != _payload_cache[0]:
        with open(PAYLOAD, encoding="utf-8") as fh:
            _payload_cache = (mtime, json.load(fh))
    body = json.loads(json.dumps(_payload_cache[1]))
    body["data"]["userId"] = ACCOUNT_ID
    body["data"]["verifiedAtUnixMs"] = int(time.time() * 1000)
    return json.dumps(body)


def paidize(body: dict) -> dict:
    body.setdefault("user", {})["subscriptionTier"] = "pro"

    sub = body.setdefault("subscription", {})
    sub.update(
        tier="pro",
        paymentStatus="active",
        hasAccess=True,
        status="active",
        currentPeriodEnd=None,
        cancelAtPeriodEnd=False,
    )

    ent = body.setdefault("entitlements", {})
    for flag in ("bridgeSpace", "voice", "apiKeys", "bridgeAgent", "bridgemindOne"):
        ent[flag] = True
    ent["tier"] = "pro"
    features = ent.setdefault("features", {})
    for flag in list(features):
        features[flag] = True
    credits = ent.setdefault("credits", {})
    credits["monthlyAllowance"] = 5000
    limits = ent.setdefault("limits", {})
    limits.update(voiceConcurrency=3, dailyTranscriptions=500, dailyPolish=500)
    return body


def is_api(flow: http.HTTPFlow) -> bool:
    return (flow.request.host or "").lower() == API_HOST


def responseheaders(flow: http.HTTPFlow) -> None:
    if flow.response is None:
        return
    content_type = flow.response.headers.get("content-type", "")
    if content_type.split(";", 1)[0].strip().lower() == "text/event-stream":
        # Forward events as they arrive instead of waiting for the stream to end.
        flow.response.stream = True


def response(flow: http.HTTPFlow) -> None:
    if flow.response is None or not is_api(flow):
        return

    path = flow.request.path.split("?", 1)[0]

    if path == "/one/entitlement":
        try:
            body = load_payload()
        except (OSError, ValueError, KeyError) as exc:
            ctx.log.warn(f"entitlement payload unusable, passing through: {exc}")
            return
        flow.response.status_code = 200
        flow.response.reason = "OK"
        flow.response.headers["content-type"] = "application/json"
        flow.response.text = body
        return

    if path == "/auth/me" and flow.response.status_code == 200:
        try:
            parsed = json.loads(flow.response.text)
            if not isinstance(parsed, dict):
                raise ValueError("not an object")
        except ValueError as exc:
            ctx.log.warn(f"/auth/me body unparsable, passing through: {exc}")
            return
        flow.response.text = json.dumps(paidize(parsed))
