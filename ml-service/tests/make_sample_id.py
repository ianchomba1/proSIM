"""Generate a synthetic (fake) Kenyan National ID image for testing the OCR flow.
The person and numbers are invented. Usage: python tests/make_sample_id.py out.png
"""
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

out = sys.argv[1] if len(sys.argv) > 1 else "sample_id.png"
img = Image.new("RGB", (1000, 630), (214, 226, 205))
d = ImageDraw.Draw(img)
try:
    big = ImageFont.truetype("arialbd.ttf", 34)
    lab = ImageFont.truetype("arial.ttf", 22)
    val = ImageFont.truetype("arialbd.ttf", 30)
except OSError:
    big = lab = val = ImageFont.load_default()

d.text((250, 25), "JAMHURI YA KENYA   REPUBLIC OF KENYA", fill=(20, 20, 20), font=big)
d.rectangle((40, 110, 300, 450), outline=(90, 90, 90), width=3)  # photo box
rows = [
    ("SERIAL NUMBER:", "234567890"),
    ("ID NUMBER:", "23456789"),
    ("FULL NAMES", "JOHN KAMAU MWANGI"),
    ("DATE OF BIRTH", "12.04.1998"),
    ("SEX", "MALE"),
    ("DISTRICT OF BIRTH", "KIAMBU"),
    ("DATE OF ISSUE", "03.06.2016"),
]
y = 105
for label, value in rows:
    d.text((340, y), label, fill=(60, 60, 60), font=lab)
    d.text((340, y + 24), value, fill=(10, 10, 10), font=val)
    y += 70
# a little blur/rotation so it isn't a perfect scan
img = img.rotate(1.5, expand=True, fillcolor=(240, 240, 240)).filter(ImageFilter.GaussianBlur(0.8))
img.save(out)
print("wrote", out)
