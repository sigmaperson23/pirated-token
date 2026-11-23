import json, urllib.request, os

at = open(r"C:\Users\sixth\AppData\Local\Temp\at4.txt").read().strip()
out = r"C:\Users\sixth\Desktop\Claude\Playground\switchyard\capture"

for path, name in [("/one/entitlement", "one_entitlement"), ("/auth/me", "auth_me")]:
    req = urllib.request.Request("https://api.bridgemind.ai" + path, headers={"Authorization": "Bearer " + at, "Accept": "application/json", "User-Agent": "BridgeMindOne/1.0"})
    try:
        with urllib.request.urlopen(req) as resp:
            b = resp.read().decode()
            open(os.path.join(out, name + ".json"), "w", encoding="utf-8").write(b)
            print("==", path, resp.status)
            print(b[:1200])
    except Exception as e:
        print("==", path, "ERR", e)
        try:
            print(e.read().decode()[:600])
        except Exception:
            pass
