# -*- coding: utf-8 -*-
"""day14-merge.py —— Day 14 窄屏修复前后对比图（2x2：320 前后 / 360 前后）"""
from PIL import Image
import os

BASE = r"E:\wordbuddy工作空间\prioritypal-desktop"
GAP = 8

def load(name):
    return Image.open(os.path.join(BASE, name))

# 2x2：上排 320（before | after），下排 360（before | after）
pairs = [
    ("day14-mobile-todo-320-before.png", "day14-mobile-todo-320.png"),
    ("day14-mobile-todo-360-before.png", "day14-mobile-todo-360.png"),
]
imgs = [[load(a), load(b)] for a, b in pairs]
w = imgs[0][0].width
h = imgs[0][0].height
canvas = Image.new("RGB", (w * 2 + GAP, h * 2 + GAP), (255, 255, 255))
pos = [(0, 0), (w + GAP, 0), (0, h + GAP), (w + GAP, h + GAP)]
flat = [im for row in imgs for im in row]
for im, p in zip(flat, pos):
    canvas.paste(im, p)

out = r"E:\wordbuddy工作空间\day14-修复前后对比.png"
canvas.save(out)
print(f"[OK] {out}  {canvas.size}")
