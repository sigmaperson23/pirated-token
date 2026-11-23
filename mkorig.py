import shutil, hashlib, os
src = r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe"
dst = r"C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe.orig"
if not os.path.exists(dst):
    shutil.copy2(src, dst)
h = hashlib.sha256(open(dst,"rb").read()).hexdigest()
print("pristine sha256", h)
print("pristine copy ready")
