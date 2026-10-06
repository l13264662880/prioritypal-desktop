# -*- coding: utf-8 -*-
"""day13-merge.py —— 把 Day 13 的 6 张原始截图拼成今日要交的两张
图1：三视图切换（竖排 3 张）  图2：四种状态（2x2 宫格：正常/空/加载/错误）
"""
from PIL import Image
import os

BASE = r"E:\wordbuddy工作空间"
GAP = 8  # 拼接缝隙

def load(name):
    return Image.open(os.path.join(BASE, f"day13-{name}.png"))

def vstack(imgs):
    w = max(i.width for i in imgs)
    h = sum(i.height for i in imgs) + GAP * (len(imgs) - 1)
    canvas = Image.new("RGB", (w, h), (255, 255, 255))
    y = 0
    for im in imgs:
        canvas.paste(im, (0, y))
        y += im.height + GAP
    return canvas

def grid2x2(imgs):
    w = imgs[0].width
    h = imgs[0].height
    canvas = Image.new("RGB", (w * 2 + GAP, h * 2 + GAP), (255, 255, 255))
    pos = [(0, 0), (w + GAP, 0), (0, h + GAP), (w + GAP, h + GAP)]
    for im, p in zip(imgs, pos):
        canvas.paste(im, p)
    return canvas

# 图1：视图切换（待办 → 番茄 → 心情）
v1 = vstack([load("view-todo"), load("view-pomodoro"), load("view-mood")])
out1 = os.path.join(BASE, "day13-截图1-视图切换.png")
v1.save(out1)
print(f"[OK] {out1}  {v1.size}")

# 图2：四种状态 2x2（正常 / 空 / 加载 / 错误）
v2 = grid2x2([load("view-todo"), load("state-empty"), load("state-loading"), load("state-error")])
out2 = os.path.join(BASE, "day13-截图2-四种状态.png")
v2.save(out2)
print(f"[OK] {out2}  {v2.size}")
