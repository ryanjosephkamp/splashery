# Makes tests/fixtures/vw/figures.pdf (lane Viewer): one page per kind of
# embedded picture that research articles use, all drawn here (no outside
# material): a photo-like JPEG, a CMYK JPEG (Adobe), a JPEG 2000 (JPX), a
# picture with a soft mask, an indexed (palette) chart with flat colors,
# and a 16-bit picture. No picture has black in it, so any black on the
# rendered page is a fault (the black boxes of September 28, 2026).
#
# Usage: pip install pillow numpy pikepdf; python3 tests/fixtures/vw/make-figures.py
# (Only for remaking the fixture; the site and the tests don't need Python.)

import io
import zlib
from pathlib import Path

import numpy as np
import pikepdf
from PIL import Image
from pikepdf import Array, Dictionary, Name, Stream

OUT = Path(__file__).with_name("figures.pdf")
pdf = pikepdf.new()


def photo(w, h):
    y, x = np.mgrid[0:h, 0:w]
    r = 150 + 100 * np.sin(x / 37.0)
    g = 150 + 100 * np.sin(y / 23.0 + 1)
    b = 150 + 100 * np.sin((x + y) / 51.0)
    return np.dstack([r, g, b]).clip(0, 255).astype(np.uint8)


def chart(w, h):
    # A bar chart with flat colors, as figures are often drawn.
    a = np.full((h, w, 3), 246, np.uint8)
    colors = [(66, 133, 200), (230, 120, 60), (90, 170, 90), (200, 80, 120), (150, 110, 190)]
    for i, c in enumerate(colors):
        top = int(h * (0.15 + 0.13 * ((i * 3) % 5)))
        a[top : h - 20, 30 + i * 70 : 80 + i * 70] = c
    a[h - 20 : h - 17, 20 : w - 20] = (120, 120, 120)
    return a


def image(data, w, h, cs, bpc=8, filt=None, extra=None):
    d = dict(Type=Name.XObject, Subtype=Name.Image, Width=w, Height=h, BitsPerComponent=bpc)
    if cs is not None:
        d["ColorSpace"] = cs
    if filt:
        d["Filter"] = filt
    s = Stream(pdf, data, **d)
    for k, v in (extra or {}).items():
        s[k] = v
    return s


def page(xobj, w=400, h=300):
    res = Dictionary(XObject=Dictionary(Im0=xobj))
    cs = f"q 1 1 1 rg 0 0 612 792 re f Q q {w} 0 0 {h} {306 - w / 2} 400 cm /Im0 Do Q\n".encode()
    pdf.pages.append(
        pikepdf.Page(
            Dictionary(Type=Name.Page, MediaBox=[0, 0, 612, 792], Resources=res, Contents=pdf.make_stream(cs))
        )
    )


def jpeg(a, mode=None, fmt="JPEG"):
    buf = io.BytesIO()
    im = Image.fromarray(a)
    (im.convert(mode) if mode else im).save(buf, fmt, **({"quality": 90} if fmt == "JPEG" else {}))
    return buf.getvalue()


W, H = 240, 180
a = photo(W, H)
page(image(jpeg(a), W, H, Name.DeviceRGB, filt=Name.DCTDecode))
page(image(jpeg(a, "CMYK"), W, H, Name.DeviceCMYK, filt=Name.DCTDecode, extra={"/Decode": Array([1, 0] * 4)}))
page(image(jpeg(a, fmt="JPEG2000"), W, H, None, filt=Name.JPXDecode))
m = (np.hypot(*np.mgrid[-H // 2 : H // 2, -W // 2 : W // 2]) < H * 0.47).astype(np.uint8) * 255
smask = image(zlib.compress(m.tobytes()), W, H, Name.DeviceGray, filt=Name.FlateDecode)
page(image(zlib.compress(a.tobytes()), W, H, Name.DeviceRGB, filt=Name.FlateDecode, extra={"/SMask": smask}))
p = Image.fromarray(chart(400, 300)).quantize(16, dither=Image.Dither.NONE)
pal = bytes(p.getpalette()[: 16 * 3])
indexed = Array([Name.Indexed, Name.DeviceRGB, 15, pikepdf.String(pal)])
page(image(zlib.compress(np.array(p).tobytes()), 400, 300, indexed, filt=Name.FlateDecode))
a16 = a.astype(">u2") * 257
page(image(zlib.compress(a16.tobytes()), W, H, Name.DeviceRGB, bpc=16, filt=Name.FlateDecode))
pdf.save(OUT)
print(OUT)
