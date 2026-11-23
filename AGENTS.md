AGENTS.md
# switchyard

reverse engineering notes on BridgeMind One. this repo is scratch work, the app itself lives in
%LOCALAPPDATA%, not here.

## BridgeMind entitlement bypass

Goal: make a free account look entitled to bridgemindOne locally. uncensored local crack, not a
subscription bypass. no server change.

Status 2026-11-08: route A works and is what you run. route B (binary patch) is documented but only
partly effective. details, all offsets, captured bodies and pitfalls are in README.md, read it
before touching anything.

Target exe  C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe
Version     0.3.4
Pristine    fbb4760897ad909b4abf35533b401ac835cebc3f45a11254fedb8b1dd0cf66c3
Backup      bridgemind-one-rust.exe.orig next to the exe. never delete it.

### Run it

  pwsh -File run.ps1     start proxy, launch app through it
  pwsh -File stop.ps1    stop both and remove the mitm CA again

run.ps1 is scoped to this repo: it listens on 127.0.0.1:8099 (bumps the port if
that is taken), keeps its own confdir/pidfile/log in .mitm/, MITMs only
api.bridgemind.ai and tunnels every other host with real certs. it does not kill
foreign mitmdump/python processes, does not touch the caller's environment and
does not use ~/.mitmproxy.

the app gets HTTPS_PROXY/ALL_PROXY plus SSL_CERT_FILE/NODE_EXTRA_CA_CERTS/
AWS_CA_BUNDLE pointed at .mitm/ca-bundle.pem (public roots + mitm CA) for its own
process only, and NO_PROXY for localhost, IMDS and AWS. the mitm CA is added to
CurrentUser\Root for the run and removed by stop.ps1, so nothing is left behind.
-KeepCa leaves it, -NoLaunch starts the proxy only, -Port overrides the port.

first launch after a wall still shows the wall. close and run it again, once is enough.

### Files

  addon.py                  mitmproxy addon, rewrites /one/entitlement and /auth/me on api.bridgemind.ai only
  patch.py                  binary patcher, prints offsets, refuses any other sha256
  mitm-ca.pem               mitmproxy ca used for the run, also seeded into .mitm/ confdir
  capture/entitlement.json  200 body template
  capture/auth_me.json      real free /auth/me capture
  capture/raw.jsonl         request/response log from the study
  docs/dec.py               dump the DPAPI vault, prints tier and entitled
  README.md                 full writeup, offsets, bytes, pitfalls
  .mitm/                    runtime state, gitignored: ca, ca-bundle.pem, proxy.json, logs

### The two things that decide the gate

GET /one/entitlement 403 BIZ_SUBSCRIPTION_REQUIRED drives access.kind = upgradeRequired.
GET /auth/me subscription.tier free drives the wall copy and is what a cold start reads.
both have to be rewritten, one alone leaves the wall up. this is the whole trick.

### Patch addresses, verified

  0x1400b6fca  access byte store, mov byte ptr [rbx+8], r10b
  0x1400b7374  biz 403 branch, mov ebp,2 / jmp 0x1400b6f81
  0x1400b6d29  403 parse-fail exit
  0x1400b6f81  shared tail, ebp outcome, r10b access byte
  0x1400b6600  state machine start, state byte [rdx+0x19]
  0x1400b67be  lea of /one/entitlement
  0x1400b6ecf  cmp eax,0xffff, the BIZ_SUBSCRIPTION_REQUIRED compare
  0x1400b7880  auth unit, serializer 0x14077a1bb writes "entitled" (next target if patch work resumes)

access enum 0/2/3 = unknown/entitled/upgradeRequired.

patch.py applies three edits: store the byte as 2, and force r10b=2 / ebp=4 at both the 403 branch
and the parse-fail exit. preferred over the spec's branch-only idea because the 403 body fails
serde before the store runs.

### Working rules

close the app before patching, it holds the exe and single instances itself
log into nothing by hand, tokens are single use on refresh
read the vault with dec.py, blob is DPAPI, skip 8 bytes, entropy
  BridgeMindOne/CredentialVault/DPAPI/v1/AuthSession
never string patch the brotli assets for the gate, the decision is rust side
mitm rewrites leave the reason phrase "Forbidden", key addon logic off the path not the status

### Known limits

voice and autopilot still 403, credits are checked server side, expected
cold start with no proxy walls even patched, live /auth/me answers free and overwrites the vault
the patch breaks Authenticode, block updates for a patched build

### Verification

  vault entitlement_evidence.wasEntitled true, user.subscriptionTier pro
  badge PRO, dashboard opens, no FeatureLock
  survives restart while the proxy is up
