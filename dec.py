import ctypes, ctypes.wintypes as w, json, sys

CRYPTPROTECT_UI_FORBIDDEN = 0x1

class DATA_BLOB(ctypes.Structure):
    _fields_ = [("cbData", w.DWORD), ("pbData", ctypes.POINTER(ctypes.c_char))]

def blob(b):
    buf = ctypes.create_string_buffer(b, len(b))
    return DATA_BLOB(len(b), ctypes.cast(buf, ctypes.POINTER(ctypes.c_char)))

def decrypt(raw, entropy):
    pin = blob(raw); pent = blob(entropy); pout = DATA_BLOB()
    ok = ctypes.windll.crypt32.CryptUnprotectData(ctypes.byref(pin), None, ctypes.byref(pent), None, None, CRYPTPROTECT_UI_FORBIDDEN, ctypes.byref(pout))
    if not ok:
        raise OSError(ctypes.GetLastError())
    return ctypes.string_at(pout.pbData, pout.cbData)

p = sys.argv[1]
ent = b"BridgeMindOne/CredentialVault/DPAPI/v1/AuthSession"
raw = open(p, "rb").read()[8:]
obj = json.loads(decrypt(raw, ent))
open(r"C:\Users\sixth\AppData\Local\Temp\live_auth.json", "w").write(json.dumps(obj, indent=1))
print("ok", list(obj.keys()))
