import sys, hashlib, os, pefile

PRISTINE_SHA = "fbb4760897ad909b4abf35533b401ac835cebc3f45a11254fedb8b1dd0cf66c3"
PATCHES = [
    (0x1400B6FCA, "44885608", "C6460802", "store access byte as entitled"),
    (0x1400B7374, "BD02000000E903FCFFFF", "41B202BD04000000E900FCFFFF", "biz 403 -> entitled + ok"),
    (0x1400B6D29, "48C70605000000B004E91D030000", "41B202BD04000000E94B02000090", "403 parse fail -> entitled + ok"),
]


def va2off(pe, va):
    base = pe.OPTIONAL_HEADER.ImageBase
    for s in pe.sections:
        if s.VirtualAddress <= va - base < s.VirtualAddress + s.SizeOfRawData:
            return s.PointerToRawData + (va - base - s.VirtualAddress)
    raise SystemExit("va not mapped: " + hex(va))


def main(src, dst=None, force=False):
    data = bytearray(open(src, "rb").read())
    digest = hashlib.sha256(data).hexdigest()
    if digest != PRISTINE_SHA and not force:
        print("sha256 mismatch")
        print("  got  " + digest)
        print("  want " + PRISTINE_SHA)
        print("pass --force to patch a file that is already patched")
        raise SystemExit(1)
    pe = pefile.PE(data=bytes(data), fast_load=True)
    for va, old_hex, new_hex, note in PATCHES:
        old, new = bytes.fromhex(old_hex), bytes.fromhex(new_hex)
        off = va2off(pe, va)
        if bytes(data[off:off + len(new)]) == new:
            print("%-30s va %#x already patched" % (note, va))
            continue
        if bytes(data[off:off + len(old)]) != old:
            raise SystemExit("unexpected bytes at %#x: %s" % (va, data[off:off + len(old)].hex(" ")))
        data[off:off + len(new)] = new
        print("%-30s va %#x file %#x" % (note, va, off))
    out = dst or src
    open(out, "wb").write(data)
    print("wrote " + out)
    print("new sha256 " + hashlib.sha256(data).hexdigest())


if __name__ == "__main__":
    argv = sys.argv[1:]
    pos = [a for a in argv if not a.startswith("--")]
    main(pos[0], pos[1] if len(pos) > 1 else None, force="--force" in argv)
