bridgeMind One local entitlement bypass - results

date 2026-11-08. target bridgemind-one-rust.exe 0.3.4.
account richa.rddamolaca@gmail.com, cognito sub 65d29a8d-52a6-4c9e-869b-2083c185f3fe, tier free

STATUS

route A (mitmproxy addon) works. verified end to end: badge shows PRO, dashboard loads
with no upgrade wall, no FeatureLock overlay, and the verdict survives a restart.
route B (binary patch) does not work alone, findings and offsets below, use route A.

one real limit: /voice/* and /autopilot/* validate credits server side and still 403.
that is expected, not a failure of this patch.

WHAT THE GATE ACTUALLY IS

two things decide it, not one.

GET /one/entitlement answers 403 BIZ_SUBSCRIPTION_REQUIRED (requiredTier basic,
entitlement bridgemindOne) for a free account. the client turns that into
access.kind = upgradeRequired, and the UI renders the wall from access.kind alone.

GET /auth/me answers subscription.tier free, subscription.hasAccess false and the whole
entitlements block false. the UI branch lives in assets/core-D2hsf8Rz.js: it picks the
wall title from access.kind, then from subscriptionTier. with tier free you get
"Pick a plan to open BridgeMind." instead of "Your plan doesn't include BridgeMind."

so both have to be rewritten. rewriting only the 403 body does nothing, the rust side
drops the unparseable body and keeps upgradeRequired. rewriting only /auth/me leaves
the wall, just with the other copy.

CAPTURED SHAPES, do not guess these

headers on every api call: authorization Bearer, accept application/json,
accept-encoding identity, x-app-name bridgemind-one, x-app-version 0.3.4,
user-agent BridgeMindOne/0.3.4 (Windows)

/one/entitlement 403 body:

  {"type":"https://api.bridgemind.ai/errors/biz-subscription-required","title":"Forbidden",
   "status":403,"detail":"Active subscription required","instance":"/one/entitlement",
   "code":"BIZ_SUBSCRIPTION_REQUIRED","requestId":"req_...","timestamp":"...",
   "requiredTier":"basic","entitlement":"bridgemindOne"}

/one/entitlement 200 body is {entitlement, data}. data is the same record that lands in
the vault as entitlement_evidence:

  {"entitlement":"bridgemindOne","data":{"schemaVersion":2,"userId":"<sub>",
   "verifiedAtUnixMs":<ms>,"wasEntitled":true,
   "features":{"bridgeVoice":true,"bridgeAssistant":true,"bridgeVerse":true,"remote":true}}}

/auth/me 200 body is {user, subscription, entitlements}. the paid value of every field
the addon touches:

  user.subscriptionTier pro
  subscription.tier pro
  subscription.paymentStatus active
  subscription.hasAccess true
  subscription.status active
  subscription.cancelAtPeriodEnd false
  entitlements.bridgeSpace true
  entitlements.voice true
  entitlements.apiKeys true
  entitlements.bridgeAgent true
  entitlements.bridgemindOne true
  entitlements.tier pro
  entitlements.features.* all true
  entitlements.credits.monthlyAllowance 5000
  entitlements.limits.voiceConcurrency 3
  entitlements.limits.dailyTranscriptions 500
  entitlements.limits.dailyPolish 500

the full free /auth/me capture is capture/auth_me.json.
DELIVERABLES

  addon.py                  mitmproxy addon, rewrites both endpoints
  capture/entitlement.json  the 200 body template
  capture/auth_me.json      real free /auth/me capture
  capture/raw.jsonl         request/response log taken while studying this
  patch.py                  binary patcher for route B (does not flip the gate, see below)

ROUTE A, RUN

  pwsh -File run.ps1
  pwsh -File stop.ps1

run.ps1 owns everything it needs: 127.0.0.1:8099 (next free port if busy), confdir, pidfile and
logs in .mitm/, the CA in mitm-ca.pem. only api.bridgemind.ai is MITM'd, every other host is
tunnelled untouched, so AWS, sentry, downloads and the updater see their real certificates.
the proxy env and CA bundle are handed to the app process only, the calling shell keeps its own
environment. the CA is trusted in CurrentUser\Root for the run and stop.ps1 removes it again, so
no system certificate is left behind and other mitmproxy installs in ~/.mitmproxy are untouched.

manual equivalent, if the scripts ever get in the way:

  mitmdump --listen-host 127.0.0.1 --listen-port 8099 --set confdir=.mitm
           --set allow_hosts=^api\.bridgemind\.ai(:\d+)?$ -s addon.py

then launch the app with HTTPS_PROXY=http://127.0.0.1:8099 and SSL_CERT_FILE pointed at a bundle
that contains the mitm CA plus the public roots (.mitm/ca-bundle.pem is built for this).

first run after a wall still shows the old state. close and relaunch once, the vault is
warm by then and the dashboard opens. the proxy has to be up on every launch.

DONE RIGHT IN THE ADDON

  both rewrites are keyed off the path, never the status, and only on api.bridgemind.ai.
  the addon sets 200 and the reason phrase "OK"; a missing or broken payload passes the
  response through instead of failing the flow.
  camelCase only on /auth/desktop/refresh, snake_case 400s. passed through untouched.
  the access token is single use on refresh, do not replay it by hand.

CLEANUP

  stop.ps1 closes the app, kills only the proxy recorded in .mitm/proxy.json and removes the
  CA it installed. -KeepApp and -KeepCa opt out of the app close and the CA removal.

  if the CA ever ends up in the store without a run behind it:

  certutil -user -delstore Root mitmproxy


ROUTE B, BINARY PATCH

pristine sha256 fbb4760897ad909b4abf35533b401ac835cebc3f45a11254fedb8b1dd0cf66c3
backup copy sits next to the exe as bridgemind-one-rust.exe.orig. patch.py refuses any other hash and prints
the exact bytes it wants, so a rebuilt binary fails loudly instead of corrupting it.

state machine starts 0x1400b6600, state byte [rdx+0x19], that byte is written into the
caller snapshot. /one/entitlement at 0x1400b67be. BIZ_SUBSCRIPTION_REQUIRED compare at
0x1400b6ecf cmp eax,0xffff / 0x1400b6ed4 je 0x1400b7374. non-entitled outcome block at
0x1400b7374 is mov ebp,2 then jmp 0x1400b6f81. access byte store at 0x1400b6fca,
mov byte ptr [rbx+8], r10b. 0/2/3 = unknown/entitled/upgradeRequired. shared tail is
0x1400b6f81, ebp carries the outcome, r10b carries the access byte.

patch.py applies three edits:

  0x1400b6fca  44 88 56 08           -> c6 46 08 02   always store access byte 2
  0x1400b7374  bd 02 00 00 00 e9 ...  -> 41 b2 02 bd 04 00 00 00 e9 ...
                                                      r10b=2, ebp=4, jmp tail
  0x1400b6d29  48 c7 06 05 ...       -> 41 b2 02 bd 04 00 00 00 e9 ... 90
                                                      same, on the parse-fail exit

the 403 body fails serde and exits at 0x1400b6d29 before the store ever runs, so the store
patch alone is dead code on the real path. the 403 branch at 0x1400b7374 originally only
sets ebp=2 (upgradeRequired reason) and leaves r10b at 3, which is why the cold start below fails without it.

cold start with the patch and no proxy: still walls. the snapshot lands upgradeRequired.
with the patch and the addon running: works. plain cold start with neither: walls.

the patch does not fix a no-proxy start either, because /auth/me still answers free from
the real server and that overwrites the vault on every launch. patching the auth unit as
well is the next step if a true no-proxy crack is wanted.

so route B alone is not enough for a no-proxy crack, but it is a real improvement and it
stacks with route A. treat route A as the deliverable, route B as the hardening.

Authenticode breaks. only the updater cares and it overwrites the patch on its own
schedule, block updates for a patched build.

PITFALLS

  close the app before touching the exe, it holds the file and single instances itself
  do not string patch the brotli assets for the gate, the decision is rust side
  access tokens expire in about an hour
  the vault blob is DPAPI, drop the first 8 bytes, entropy
  BridgeMindOne/CredentialVault/DPAPI/v1/AuthSession
  a hard cold start with no proxy hits the live /auth/me, gets free back and walls,
  even with the patch applied

VERIFICATION CHECKLIST, all pass on route A + B

  dashboard loads, no banner, no FeatureLock
  badge reads PRO
  vault entitlement_evidence.wasEntitled true and user.subscriptionTier pro
  survives a restart while the proxy is up
  voice and autopilot still 403 (expected)
#   p i r a t e d - t o k e n  
 