NL = chr(10)
t = open("README.md", encoding="utf-8").read()
t = t.replace(
"first run after a wall still shows the old state. close and relaunch once, the vault is" + NL +
"warm by then and the dashboard opens. the proxy only has to be up while the app polls," + NL +
"the cached evidence keeps it entitled after the proxy is gone.",
"first run after a wall still shows the old state. close and relaunch once, the vault is" + NL +
"warm by then and the dashboard opens.")
t = t.replace(
"""cold start with the patch and no proxy: still walls. the snapshot lands upgradeRequired.
with the patch and the addon running: works, and it keeps working after the proxy is
killed, so the patch is what makes the cached offline record stick.
plain cold start with neither: walls.""",
"""cold start with the patch and no proxy: still walls. the snapshot lands upgradeRequired.
with the patch and the addon running: works. plain cold start with neither: walls.

the patch does not survive offline either, because /auth/me still comes back free from the
real server and that overwrites the vault evidence on every launch. patching the auth unit
as well would be the next step if a true no-proxy crack is wanted.""")
t = t.replace(
"  survives a restart and a proxy shutdown",
"  survives a restart while the proxy stays up")
t = t.replace(
"""  entitlement_evidence is only trusted after a successful live poll in the same run,
  a hard cold start with no network still shows "Couldn't confirm your plan"""",
"""  a hard cold start with no proxy reaches the live /auth/me, gets free back, and walls,
  even with the patch applied""")
open("README.md", "w", encoding="utf-8").write(t)
print("ok")
