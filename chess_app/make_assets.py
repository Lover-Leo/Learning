# -*- coding: utf-8 -*-
"""
立体棋子素材生成器（开发期工具，运行时不需要 Pillow）
- 4x 超采样(256)绘制 -> LANCZOS 缩到 64px PNG
- 两套风格: classic(象牙/乌木) 与 wood(枫木/胡桃木)
- 输出 assets/*.png、assets/_preview.png 预览、piece_assets.py(base64 内嵌)
"""
import base64
import io
import os
from PIL import Image, ImageDraw, ImageFilter

SS = 256                      # 超采样画布
OUT = 64
HERE = os.path.dirname(os.path.abspath(__file__))
ASSET_DIR = os.path.join(HERE, "assets")

# (高光色, 阴影色, 描边色, 沟槽暗纹, 高光纹)
PALETTES = {
    "classic": {
        "w": ((253, 250, 242), (194, 184, 164), (96, 84, 64),
              (150, 138, 116), (255, 255, 252)),
        "b": ((96, 90, 84), (14, 12, 10), (0, 0, 0),
              (34, 30, 27), (150, 142, 132)),
    },
    "wood": {
        "w": ((240, 208, 158), (172, 128, 74), (92, 58, 28),
              (150, 104, 58), (250, 230, 196)),
        "b": ((146, 92, 52), (48, 26, 12), (22, 10, 5),
              (92, 54, 28), (178, 128, 84)),
    },
}


# ---------------- 各棋子剪影（白色画到 mask 上） ----------------
def _base(d):
    d.ellipse((54, 202, 202, 234), fill=255)          # 底座
    d.polygon([(72, 204), (184, 204), (170, 180), (86, 180)], fill=255)
    d.ellipse((86, 166, 170, 190), fill=255)          # 底座领圈


def silhouette(kind, d):
    if kind == "pawn":
        _base(d)
        d.polygon([(99, 176), (157, 176), (150, 118), (106, 118)], fill=255)
        d.ellipse((104, 110, 152, 132), fill=255)
        d.ellipse((93, 42, 163, 112), fill=255)       # 圆头
    elif kind == "rook":
        _base(d)
        d.polygon([(98, 106), (158, 106), (168, 176), (88, 176)], fill=255)
        d.rectangle((88, 78, 168, 110), fill=255)     # 城冠方块
        for x0 in (88, 120, 152):                     # 三个雉堞
            d.rectangle((x0, 50, x0 + 16, 82), fill=255)
    elif kind == "bishop":
        _base(d)
        d.ellipse((100, 96, 156, 174), fill=255)
        d.polygon([(100, 150), (156, 150), (146, 102), (128, 38), (110, 102)],
                  fill=255)                           # 尖冠
        d.ellipse((118, 24, 138, 44), fill=255)       # 顶珠
    elif kind == "knight":
        _base(d)
        d.polygon([
            (94, 190), (168, 190), (162, 152), (180, 130), (188, 102),
            (178, 74), (166, 56), (150, 48), (132, 52), (106, 62),
            (84, 82), (74, 100), (90, 108), (104, 104), (98, 124),
            (112, 134), (106, 154)], fill=255)
        d.polygon([(150, 48), (162, 30), (170, 58)], fill=255)  # 耳尖
    elif kind == "queen":
        _base(d)
        d.polygon([(99, 176), (157, 176), (150, 100), (106, 100)], fill=255)
        d.polygon([(104, 100), (152, 100), (146, 78), (110, 78)], fill=255)
        d.ellipse((96, 88, 160, 112), fill=255)       # 冠环
        for i, x in enumerate((100, 114, 128, 142, 156)):
            rr = 11 if i == 2 else 9
            d.ellipse((x - rr, 60 - rr, x + rr, 60 + rr), fill=255)
    elif kind == "king":
        _base(d)
        d.polygon([(99, 176), (157, 176), (150, 104), (106, 104)], fill=255)
        d.ellipse((98, 84, 158, 112), fill=255)       # 肩部
        d.rectangle((121, 28, 135, 82), fill=255)     # 竖十字
        d.rectangle((106, 42, 150, 57), fill=255)     # 横十字


# ---------------- 细节纹理（画在成品上） ----------------
def details(kind, draw, pal):
    groove = pal[3]
    light = pal[4]
    # 底座两道环纹
    draw.arc((60, 196, 196, 226), 20, 160, fill=groove, width=3)
    draw.arc((88, 166, 168, 188), 200, 340, fill=groove, width=3)
    if kind == "rook":
        draw.line((92, 120, 164, 120), fill=groove, width=3)
        draw.line((94, 138, 162, 138), fill=groove, width=3)
    elif kind == "bishop":
        draw.line((112, 118, 144, 96), fill=groove, width=4)
        draw.arc((104, 70, 152, 120), 210, 330, fill=light, width=3)
    elif kind == "knight":
        draw.line((150, 70, 120, 96), fill=groove, width=3)   # 鬃毛
        draw.line((160, 96, 132, 120), fill=groove, width=3)
        draw.ellipse((96, 88, 104, 96), fill=groove)           # 眼
    elif kind == "queen":
        draw.arc((104, 100, 152, 128), 200, 340, fill=groove, width=3)
        for x in (100, 128, 156):
            draw.arc((x - 8, 52, x + 8, 68), 200, 340, fill=light, width=2)
    elif kind == "king":
        draw.arc((102, 86, 154, 112), 200, 340, fill=groove, width=3)


def lerp(c1, c2, t):
    return tuple(int(a + (b - a) * t) for a, b in zip(c1, c2))


def render(kind, style, color):
    pal = PALETTES[style][color]
    hi, lo, outline = pal[0], pal[1], pal[2]

    mask = Image.new("L", (SS, SS), 0)
    silhouette(kind, ImageDraw.Draw(mask))

    # 投影
    shadow = Image.new("RGBA", (SS, SS), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.ellipse((56, 214, 200, 240), fill=(0, 0, 0, 110))
    shadow = shadow.filter(ImageFilter.GaussianBlur(7))

    # 描边层（mask 膨胀后做外圈）
    edge = mask.filter(ImageFilter.MaxFilter(7))
    outline_layer = Image.new("RGBA", (SS, SS), outline + (255,))
    outline_layer.putalpha(edge)

    # 主体：纵向渐变 + 横向圆柱受光（光源左上）
    body = Image.new("RGBA", (SS, SS), (0, 0, 0, 0))
    bp = body.load()
    mp = mask.load()
    for y in range(SS):
        tv = y / (SS - 1)
        row = lerp(hi, lo, tv ** 0.9)
        for x in range(SS):
            if mp[x, y]:
                u = (x - 110) / 118.0
                u = max(-1.0, min(1.0, u))
                shade = 0.74 + 0.26 * (1 - u * u)         # 中间亮两侧暗
                bp[x, y] = tuple(max(0, min(255, int(c * shade))) for c in row) + (255,)
    # 左上柔光
    sheen = Image.new("RGBA", (SS, SS), (0, 0, 0, 0))
    ImageDraw.Draw(sheen).ellipse((78, 48, 132, 200), fill=pal[4] + (56,))
    sheen = sheen.filter(ImageFilter.GaussianBlur(14))

    out = Image.alpha_composite(shadow, outline_layer)
    out = Image.alpha_composite(out, body)
    out = Image.alpha_composite(out, sheen)
    details(kind, ImageDraw.Draw(out), pal)
    # 木纹：几道纵向弧线
    if style == "wood":
        grain = Image.new("RGBA", (SS, SS), (0, 0, 0, 0))
        gd = ImageDraw.Draw(grain)
        for x0 in (104, 124, 144):
            gd.arc((x0 - 40, 60, x0 + 40, 210), 95, 265, fill=pal[3] + (70,), width=3)
        grain.putalpha(Image.composite(grain.split()[3], Image.new("L", (SS, SS), 0), mask))
        out = Image.alpha_composite(out, grain)
    return out.resize((OUT, OUT), Image.LANCZOS)


KINDS = ("king", "queen", "rook", "bishop", "knight", "pawn")
COLORS = ("w", "b")


def main():
    os.makedirs(ASSET_DIR, exist_ok=True)
    encoded = {}
    tiles = []
    for style in ("classic", "wood"):
        for color in COLORS:
            row = []
            for kind in KINDS:
                img = render(kind, style, color)
                path = os.path.join(ASSET_DIR, f"{style}_{color}_{kind}.png")
                img.save(path)
                buf = io.BytesIO()
                img.save(buf, format="PNG")
                encoded[f"{style}_{color}_{kind}"] = base64.b64encode(
                    buf.getvalue()).decode("ascii")
                row.append(img)
            tiles.append(row)

    # 预览图：4 行 × 6 列，棋盘格底
    cell = OUT
    preview = Image.new("RGB", (cell * 6, cell * 4), (255, 255, 255))
    pd = ImageDraw.Draw(preview)
    for ri, row in enumerate(tiles):
        for ci, img in enumerate(row):
            x, y = ci * cell, ri * cell
            light = (235, 236, 208) if ri < 2 else (232, 207, 160)
            dark = (119, 149, 86) if ri < 2 else (158, 107, 63)
            pd.rectangle((x, y, x + cell, y + cell),
                         fill=light if (ri + ci) % 2 == 0 else dark)
            preview.paste(img, (x, y), img)
    preview = preview.resize((cell * 6 * 2, cell * 4 * 2), Image.NEAREST)
    preview.save(os.path.join(ASSET_DIR, "_preview.png"))

    # 内嵌资源模块
    lines = ['# -*- coding: utf-8 -*-',
             '"""由 make_assets.py 自动生成的立体棋子 PNG(base64)，请勿手改。"""',
             'PIECE_B64 = {']
    for k, v in encoded.items():
        lines.append(f'    {k!r}: {v!r},')
    lines.append('}')
    with open(os.path.join(HERE, "piece_assets.py"), "w", encoding="utf-8") as fp:
        fp.write("\n".join(lines))
    size_kb = os.path.getsize(os.path.join(HERE, "piece_assets.py")) // 1024
    print(f"生成 {len(encoded)} 个棋子, piece_assets.py 约 {size_kb} KB")


if __name__ == "__main__":
    main()
