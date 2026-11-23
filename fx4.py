Q = '"'
NL = chr(10)
t = open("README.md", encoding="utf-8").read()
t = t.replace(
  "first run after a wall still shows the old state. close and relaunch once, the vault is" + NL +
  "warm by then and the dashboard opens. the proxy only has to be up while the app polls," + NL +
  "the cached evidence keeps it entitled after the proxy is gone.",
  "first run after a wall still shows the old state. close and relaunch once, the vault is" + NL +
  "warm by then and the dashboard opens. the proxy has to be up on every launch.")
t = t.replace(
  "with the patch and the addon running: works, and it keeps working after the proxy is" + NL +
  "killed, so the patch is what makes the cached offline record stick." + NL +
  "plain cold start with neither: walls.",
  "with the patch and the addon running: works. plain cold start with neither: walls." + NL + NL +
  "the patch does not fix a no-proxy start either, because /auth/me still answers free from" + NL +
  "the real server and that overwrites the vault on every launch. patching the auth unit as" + NL +
  "well is the next step if a true no-proxy crack is wanted.")
t = t.replace("  survives a restart and a proxy shutdown",
              "  survives a restart while the proxy is up")
t = t.replace(
  "  entitlement_evidence is only trusted after a successful live poll in the same run," + NL +
  "  a hard cold start with no network still shows " + Q + "Couldn't confirm your plan" + Q,
  "  a hard cold start with no proxy hits the live /auth/me, gets free back and walls," + NL +
  "  even with the patch applied")
open("README.md", "w", encoding="utf-8").write(t)
print("ok")
