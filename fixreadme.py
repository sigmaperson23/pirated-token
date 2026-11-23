import sys
t = open("README.md", encoding="utf-8").read()
old_start = t.index("ROUTE B, WHAT IT DOES AND WHY IT FALLS SHORT")
old_end = t.index("PITFALLS")
new = """ROUTE B, BINARY PATCH

pristine sha256 fbb4760897ad909b4abf35533b401ac835cebc3f45a11254fedb8b1dd0cf66c3
backup copy sits next to the exe as bridgemind-one-rust.exe.orig. patch.py refuses any
other hash and prints the exact bytes it wants, so a rebuilt binary fails loudly"
" instead of silently corrupting.

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
sets ebp=2 (upgradeRequired reason) and leaves r10b at 3, which is why the plot below
fails without it.

cold start with the patch and no proxy: still walls. the snapshot lands upgradeRequired.
with the patch and the addon running: works, and it keeps working after the proxy is
killed, so the patch is what makes the cached offline record stick.
plain cold start with neither: walls.

so route B alone is not enough for a no-proxy crack, but it is a real improvement and it
stacks with route A. treat route A as the deliverable, route B as the hardening.

Authenticode breaks. only the updater cares and it overwrites the patch on its own
schedule, block updates for a patched build.

"""
t = t[:old_start] + new + t[old_end:]
open("README.md", "w", encoding="utf-8").write(t)
print("done")
