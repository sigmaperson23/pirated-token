import urllib.request, json
for p in ["/openapi.json", "/v1/openapi.json", "/docs", "/swagger.json"]:
    try:
        req = urllib.request.Request("https://api.bridgemind.ai" + p, headers={"User-Agent": "BridgeMindOne/1.0"})
        with urllib.request.urlopen(req) as resp:
            b = resp.read()
            print(p, resp.status, len(b), b[:120])
    except Exception as e:
        print(p, "ERR", e)
