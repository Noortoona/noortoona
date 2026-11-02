"""Export the committed outline SVGs for web and Expo. Requires PyMuPDF, Pillow, numpy."""
from pathlib import Path
import shutil
import fitz
import numpy as np
from PIL import Image

for source, destination, size in [
    ('hala-logo-dark.svg', 'assets/brand/hala-logo-dark.png', 1580),
    ('hala-logo.svg', 'assets/brand/hala-logo.png', 1580),
    ('hala-icon.svg', 'assets/brand/hala-icon.png', 1024),
    ('hala-icon.svg', 'assets/brand/hala-icon-192.png', 192),
    ('hala-icon-foreground.svg', 'mobile/assets/hala-icon-foreground.png', 1024),
]:
    # MuPDF's SVG importer does not reproduce the web gradient: render the
    # outline alpha and apply the same champagne family deterministically.
    svg = (Path('assets/brand') / source).read_text().replace('url(#gold)', '#FFFFFF')
    document = fitz.open(stream=svg.encode(), filetype='svg')
    page = document[0]
    pixmap = page.get_pixmap(matrix=fitz.Matrix(size/page.rect.width, size/page.rect.width), alpha=True)
    rgba = np.frombuffer(pixmap.samples, dtype=np.uint8).reshape(pixmap.height, pixmap.width, 4).copy()
    gold_pixels = (rgba[:, :, 0] > 100) & (rgba[:, :, 3] > 0)
    progress = np.linspace(0, 1, pixmap.height)[:, None, None]
    gold = np.array([240, 208, 138])*(1-progress) + np.array([181, 133, 53])*progress
    rgba[:, :, :3] = np.where(gold_pixels[:, :, None], np.broadcast_to(gold, (pixmap.height, pixmap.width, 3)), rgba[:, :, :3])
    Image.fromarray(rgba).save(destination)

shutil.copy('assets/brand/hala-logo-dark.png', 'mobile/assets/hala-logo.png')
shutil.copy('assets/brand/hala-icon.png', 'mobile/assets/hala-icon.png')
canvas = Image.new('RGB', (1200, 630), '#11151D')
logo = Image.open('assets/brand/hala-logo-dark.png')
logo.thumbnail((820, 364), Image.Resampling.LANCZOS)
canvas.paste(logo, ((1200-logo.width)//2, (630-logo.height)//2), logo)
canvas.save('assets/brand/hala-og.png')
