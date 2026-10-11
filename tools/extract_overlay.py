# -*- coding: utf-8 -*-
"""extract_overlay.py —— 主题覆盖层提取管线（已验证版）。

用法：python tools/extract_overlay.py <穿衣图路径> <输出overlay路径>
穿衣图必须是用图生图、以「底模源图」为输入生成的「小猫穿整套主题装」图片
（姿势/布局与底模一致，模型保证不重画猫）。

原理：穿衣图与底模源图逐像素差分 → 高容差(90) + 预模糊去重绘噪点 →
取最大连通域（衣服）→ 用固定裁切框(226,60,795,959)→78×124→贴(25,4)
（与底模完全相同的锚点变换），得到与 idle.png 像素对齐的主题覆盖层。"""
import sys, os
from PIL import Image, ImageFilter, ImageDraw
from collections import deque

CROP = (226, 60, 795, 959)
TOL = 90

def prep(img):
    w, h = img.size
    for sx, sy in [(0,0),(w-1,0),(0,h-1),(w-1,h-1),(w//2,h-1)]:
        try: ImageDraw.floodfill(img, (sx,sy), (255,0,255,255), thresh=30)
        except Exception: pass
    p = img.load()
    alpha = Image.new("L", (w,h), 255); ap = alpha.load()
    for y in range(h):
        for x in range(w):
            r,g,b,a = p[x,y]
            if r>240 and b>240 and g<80: ap[x,y]=0
    alpha = alpha.filter(ImageFilter.GaussianBlur(1))
    img.putalpha(alpha)
    return img.filter(ImageFilter.GaussianBlur(2)), img

def extract(dressed_path, base_src_path, out_path):
    base = Image.open(base_src_path).convert("RGBA")
    dressed = Image.open(dressed_path).convert("RGBA")
    baseB, baseO = prep(base)
    dresB, dresO = prep(dressed)
    w, h = base.size
    bp, dp = baseB.load(), dresB.load()
    mask = Image.new("L", (w,h), 0); mp = mask.load()
    for y in range(h):
        for x in range(w):
            br,bg,bb,ba = bp[x,y]
            dr,dg,db,da = dp[x,y]
            if ba < 128 or da < 128: continue
            if abs(br-dr)+abs(bg-dg)+abs(bb-db) > TOL: mp[x,y]=255
    mask = mask.filter(ImageFilter.MedianFilter(7))
    mask = mask.filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.MinFilter(7))
    mask = mask.filter(ImageFilter.MaxFilter(5))
    # 全分辨率最大连通域
    seen = bytearray(w*h); best = []
    A = dresO.getchannel("A"); dap = A.load()
    for y0 in range(h):
        for x0 in range(w):
            if mp[x0,y0]>128 and not seen[y0*w+x0]:
                comp=[]; q=deque([(x0,y0)]); seen[y0*w+x0]=1
                while q:
                    x,y=q.popleft(); comp.append((x,y))
                    for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                        nx,ny=x+dx,y+dy
                        if 0<=nx<w and 0<=ny<h and mp[nx,ny]>128 and not seen[ny*w+nx]:
                            seen[ny*w+nx]=1; q.append((nx,ny))
                if len(comp)>len(best): best=comp
    keep = Image.new("L", (w,h), 0); kp = keep.load()
    for x,y in best: kp[x,y] = dap[x,y]
    keep = keep.filter(ImageFilter.MaxFilter(3))
    overlay = Image.new("RGBA", (w,h), (0,0,0,0))
    dp2 = dresO.load(); kp2 = keep.load()
    op = overlay.load()
    for y in range(h):
        for x in range(w):
            if kp2[x,y] > 60: op[x,y] = dp2[x,y]
    out = overlay.crop(CROP).resize((78,124), Image.LANCZOS)
    final = Image.new("RGBA", (128,128), (0,0,0,0))
    final.paste(out, (25,4), out)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    final.save(out_path)
    print("已保存", out_path, f"（衣服连通域 {len(best)} px）")

if __name__ == "__main__":
    dressed, out = sys.argv[1], sys.argv[2]
    base_src = os.path.join(os.path.dirname(__file__), "..",
                            "generated-base-src.png")
    # 底模源图随仓库分发，路径固定
    base_src = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                            "assets", "cat-base", "base-src-1024.png")
    extract(dressed, base_src, out)
