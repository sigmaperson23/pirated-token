import ctypes, ctypes.wintypes as w, json, sys

CRYPTPROTECT_UI_FORBIDDEN = 0x1
ENTROPY = b'BridgeMindOne/CredentialVault/DPAPI/v1/AuthSession'

class DATA_BLOB(ctypes.Structure):
    _fields_ = [('cbData', w.DWORD), ('pbData', ctypes.POINTER(ctypes.c_char))]

def blob(b):
    buf = ctypes.create_string_buffer(b, len(b))
    return DATA_BLOB(len(b), ctypes.cast(buf, ctypes.POINTER(ctypes.c_char)))

def decrypt(raw):
    pin, pent, pout = blob(raw), blob(ENTROPY), DATA_BLOB()
    ok = ctypes.windll.crypt32.CryptUnprotectData(ctypes.byref(pin), None, ctypes.byref(pent),
                                                  None, None, CRYPTPROTECT_UI_FORBIDDEN, ctypes.byref(pout))
    if not ok:
        raise OSError(ctypes.GetLastError())
    return ctypes.string_at(pout.pbData, pout.cbData)

path = sys.argv[1]
obj = json.loads(decrypt(open(path, 'rb').read()[8:]))
json.dump(obj, open(sys.argv[2], 'w'), indent=1)
print('tier ' + obj['user']['subscriptionTier'])
print('entitled ' + str(obj['entitlement_evidence']['wasEntitled']))
