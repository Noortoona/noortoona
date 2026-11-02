"""One-time outline extraction from the owner-approved logo board.

Requires Pillow, numpy and scipy. Input is the approved 1536x1024 board, not a mockup.
Paths retain the approved lettering instead of depending on an installed font.
"""
import sys
from pathlib import Path
from PIL import Image
import numpy as np
from scipy.ndimage import gaussian_filter

source = Image.open(sys.argv[1]).convert('RGB')
pixels = np.asarray(source).astype(float)
mask = (pixels[:, :, 0] > 85) & (pixels[:, :, 0] > pixels[:, :, 2] * 1.45) & (pixels[:, :, 1] > pixels[:, :, 2] * 1.25)
mask[520:] = False
mask[:140] = False
mask[:, :370] = False
mask[:, 1160:] = False

mask = gaussian_filter(mask.astype(float), 0.8) > 0.5

def simplify(points, epsilon=1.1):
    if len(points) < 3:
        return points
    a, b = np.array(points[0]), np.array(points[-1])
    v = b - a
    p = np.array(points)
    d = np.linalg.norm(p - a, axis=1) if not np.any(v) else np.abs(v[0]*(p[:,1]-a[1])-v[1]*(p[:,0]-a[0])) / np.linalg.norm(v)
    i = int(np.argmax(d))
    return simplify(points[:i+1], epsilon)[:-1] + simplify(points[i:], epsilon) if d[i] > epsilon else [points[0], points[-1]]

edges = {}
height, width = mask.shape
for y, x in zip(*np.where(mask)):
    for empty, a, b in [
        (y == 0 or not mask[y-1,x], (x,y), (x+1,y)),
        (x == width-1 or not mask[y,x+1], (x+1,y), (x+1,y+1)),
        (y == height-1 or not mask[y+1,x], (x+1,y+1), (x,y+1)),
        (x == 0 or not mask[y,x-1], (x,y+1), (x,y))]:
        if empty:
            edges.setdefault(a, []).append(b)
loops=[]
while edges:
    start=next(iter(edges))
    points=[start]
    while True:
        a=points[-1]
        b=edges[a].pop()
        if not edges[a]: del edges[a]
        points.append(b)
        if b == start: break
    if len(points) > 30: loops.append(simplify(points))

def path(selected):
    paths=[]
    for points in selected:
        p=points[:-1]
        midpoint=lambda a,b: f'{(a[0]+b[0])/2:g},{(a[1]+b[1])/2:g}'
        d='M'+midpoint(p[-1],p[0])
        for i,a in enumerate(p):
            d+=f' Q{a[0]},{a[1]} '+midpoint(a,p[(i+1)%len(p)])
        paths.append(d+' Z')
    return ' '.join(paths)

def svg(viewbox, selected, fill, background=''):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewbox}" role="img" aria-labelledby="title"><title id="title">هلا HALA — approved November 2026</title><defs><linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#F0D08A"/><stop offset=".55" stop-color="#D3A447"/><stop offset="1" stop-color="#B58535"/></linearGradient></defs>{background}<path fill="{fill}" fill-rule="evenodd" d="{path(selected)}"/></svg>'''

out=Path('assets/brand')
for name in ['hala-logo-dark.svg','hala-logo.svg']:
    (out/name).write_text(svg('375 145 790 350', loops, 'url(#gold)'))
(out/'hala-logo-mono.svg').write_text(svg('375 145 790 350', loops, '#11151D'))
icon=[p for p in loops if min(x for x,y in p) > 860]
(out/'hala-icon.svg').write_text(svg('740 20 540 540', icon, 'url(#gold)', '<path fill="#11151D" d="M740 20h540v540H740z"/>'))
(out/'hala-icon-foreground.svg').write_text(svg('740 20 540 540', icon, 'url(#gold)'))
print(f'Extracted {len(loops)} logo contours; {len(icon)} icon contours')
