from PIL import Image, ImageDraw, ImageFilter
import math, os

OUT = os.path.dirname(os.path.abspath(__file__))

def rounded_square(size, radius, color):
    img = Image.new('RGBA', (size, size), (0,0,0,0))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle([(0,0),(size-1,size-1)], radius=radius, fill=color)
    return img

def garden_icon(size=512):
    # Warm ivory background with green gradient
    bg = rounded_square(size, size//5, (247, 245, 239, 255))
    draw = ImageDraw.Draw(bg)
    # Soft green circle background
    cx, cy = size//2, size//2 + size//20
    r = size//2 - size//10
    for i in range(r, 0, -2):
        alpha = int(30 * (i/r))
        col = (91, 140, 90, alpha)
        draw.ellipse([(cx-i, cy-i), (cx+i, cy+i)], fill=col)

    # Draw sprout - stem
    stem_color = (91, 140, 90, 255)
    stem_w = size//30
    # Stem curve
    stem_pts = []
    for t in range(0, 101, 5):
        tf = t/100
        x = cx + math.sin(tf * math.pi * 0.6) * size/40
        y = cy + size/4 - tf * size/2.2
        stem_pts.append((x, y))
    for i in range(len(stem_pts)-1):
        draw.line([stem_pts[i], stem_pts[i+1]], fill=stem_color, width=stem_w)

    # Left leaf
    top_x, top_y = stem_pts[-1]
    leaf_color = (124, 179, 66, 255)
    # Draw left leaf as polygon (teardrop)
    def leaf_shape(cx2, cy2, w, h, angle_deg):
        pts = []
        for a in range(0, 361, 5):
            ar = math.radians(a)
            # teardrop parametric
            x = math.cos(ar) * w
            y = math.sin(ar) * h * (1 - 0.3*math.cos(ar))
            ang = math.radians(angle_deg)
            rx = x*math.cos(ang) - y*math.sin(ang)
            ry = x*math.sin(ang) + y*math.cos(ang)
            pts.append((cx2+rx, cy2+ry))
        return pts
    # left leaf
    lp = leaf_shape(top_x - size/8, top_y + size/20, size/6, size/10, -30)
    draw.polygon(lp, fill=leaf_color, outline=(67, 160, 71, 255))
    # right leaf slightly higher
    rp = leaf_shape(top_x + size/8, top_y - size/40, size/7, size/11, 30)
    draw.polygon(rp, fill=(165, 214, 167, 255), outline=(102, 187, 106, 255))

    # Small shadow under
    sd = Image.new('RGBA', (size, size), (0,0,0,0))
    sdraw = ImageDraw.Draw(sd)
    sdraw.ellipse([(cx-size/5, cy+size/3-size/30),(cx+size/5, cy+size/3+size/30)], fill=(0,0,0,40))
    sd = sd.filter(ImageFilter.GaussianBlur(size//80))
    bg.alpha_composite(sd)
    # Put leaves on top again (since we added shadow after)
    # Actually compose in correct order: redo
    final = rounded_square(size, size//5, (247, 245, 239, 255))
    fdraw = ImageDraw.Draw(final)
    # soft gradient
    for i in range(r, 0, -2):
        alpha = int(25 * (i/r))
        col = (91, 140, 90, alpha)
        fdraw.ellipse([(cx-i, cy-i), (cx+i, cy+i)], fill=col)
    # shadow
    final.alpha_composite(sd)
    # stem
    for i in range(len(stem_pts)-1):
        fdraw.line([stem_pts[i], stem_pts[i+1]], fill=stem_color, width=stem_w)
    # leaves
    fdraw.polygon(lp, fill=leaf_color, outline=(67, 160, 71, 255))
    fdraw.polygon(rp, fill=(165, 214, 167, 255), outline=(102, 187, 106, 255))
    return final

def creature_icon(size=512):
    # Purple gradient background
    final = rounded_square(size, size//5, (108, 99, 255, 255))
    fdraw = ImageDraw.Draw(final)
    # Soft lighter center
    cx, cy = size//2, size//2
    r = size//2
    for i in range(r, 0, -3):
        alpha = int(20 * (1 - i/r))
        col = (255, 255, 255, alpha)
        fdraw.ellipse([(cx-i, cy-i), (cx+i, cy+i)], fill=col)

    # Creature body - blob shape
    bump_count = 14
    body_r = size * 0.28
    body_pts = []
    for i in range(bump_count * 8 + 1):
        a = (i / (bump_count * 8)) * math.pi * 2
        variance = math.sin(i * 0.5) * body_r * 0.08
        rr = body_r + variance
        bx = cx + math.cos(a) * rr
        by = cy + math.sin(a) * rr * 0.95
        body_pts.append((bx, by))
    fdraw.polygon(body_pts, fill=(255, 255, 255, 245))

    # Eyes
    eye_r = size // 22
    fdraw.ellipse([(cx-size*0.08-eye_r, cy-size*0.04-eye_r),(cx-size*0.08+eye_r, cy-size*0.04+eye_r)], fill=(30,30,58,255))
    fdraw.ellipse([(cx+size*0.08-eye_r, cy-size*0.04-eye_r),(cx+size*0.08+eye_r, cy-size*0.04+eye_r)], fill=(30,30,58,255))
    # Eye highlights
    hr = eye_r // 3
    fdraw.ellipse([(cx-size*0.08-hr+hr, cy-size*0.04-hr-hr),(cx-size*0.08+hr+hr, cy-size*0.04+hr-hr)], fill=(255,255,255,255))
    fdraw.ellipse([(cx+size*0.08-hr+hr, cy-size*0.04-hr-hr),(cx+size*0.08+hr+hr, cy-size*0.04+hr-hr)], fill=(255,255,255,255))
    # Smile
    smile_box = [(cx-size*0.08, cy+size*0.01),(cx+size*0.08, cy+size*0.08)]
    fdraw.arc(smile_box, start=0, end=180, fill=(30,30,58,255), width=size//50)
    # Cheeks
    cheek_r = size // 30
    fdraw.ellipse([(cx-size*0.17-cheek_r, cy+size*0.02-cheek_r),(cx-size*0.17+cheek_r, cy+size*0.02+cheek_r)], fill=(255, 184, 184, 180))
    fdraw.ellipse([(cx+size*0.17-cheek_r, cy+size*0.02-cheek_r),(cx+size*0.17+cheek_r, cy+size*0.02+cheek_r)], fill=(255, 184, 184, 180))

    return final

# Generate all sizes
sizes = [180, 192, 512]
for s in sizes:
    g = garden_icon(s)
    g.save(os.path.join(OUT, f'icon-garden-{s}.png'))
    c = creature_icon(s)
    c.save(os.path.join(OUT, f'icon-creature-{s}.png'))
print('done')
