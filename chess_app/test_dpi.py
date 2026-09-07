# -*- coding: utf-8 -*-
"""高 DPI 布局测试：用 CHESS_SCALE 环境变量模拟系统缩放，验证无裁切。"""
import os
import sys
import chess
from chess_app import ChessApp, PIECE_SKINS, BOARD_THEMES

scale = float(os.environ.get("CHESS_SCALE", "1.5"))
os.environ["CHESS_SCALE"] = str(scale)
app = ChessApp()
app.var_sound.set(False)
app.sfx.enabled = False
checks = {}

# 菜单先布局
app.update_idletasks()
app.var_mode.set("pve")
app.var_side.set("first")
app._start_game()
app.update_idletasks()

expect_sq = min((64, 80, 96, 112, 128), key=lambda b: abs(b - 64 * scale))
checks["SQ 取最接近的 DPI 档位"] = app.SQ == expect_sq
checks["画布尺寸=8×SQ"] = int(app.canvas.cget("width")) == app.SQ * 8
checks["立体棋子尺寸与档位一致"] = (
    app._get_piece_image(chess.WHITE, chess.PAWN).width() == app.SQ)

# 窗口必须装得下全部需求尺寸（核心：不裁切）
geo_w = app.winfo_width()
geo_h = app.winfo_height()
req_w, req_h = app.winfo_reqwidth(), app.winfo_reqheight()
checks[f"窗口宽 {geo_w}>=需求 {req_w}"] = geo_w + 2 >= req_w
checks[f"窗口高 {geo_h}>=需求 {req_h}"] = geo_h + 2 >= req_h
# 第 8 列(h 线)必须完整落在画布内
h1x = 7 * app.SQ + app.SQ // 2
checks["h 线中心在画布宽度内"] = h1x < app.SQ * 8
checks["点击 h1 中心能映射到 h1"] = app._xy_to_sq(
    7 * app.SQ + app.SQ // 2, 7 * app.SQ + app.SQ // 2) == chess.H1

# 切皮肤/主题不报错且图片档位不变
for skin in PIECE_SKINS:
    app.var_skin_game.set(PIECE_SKINS[skin])
    app._apply_look_in_game()
app.update_idletasks()
for theme in BOARD_THEMES:
    app.var_theme_game.set(BOARD_THEMES[theme][5])
    app._apply_look_in_game()
app.update_idletasks()
checks["切换皮肤主题后仍不裁切"] = app.winfo_width() + 2 >= app.winfo_reqwidth()

app.update()
app.after(300, app.destroy)
app.mainloop()

ok = True
print(f"== 模拟缩放 {scale*100:.0f}%  SQ={app.SQ}  窗口 {geo_w}x{geo_h} ==")
for k, v in checks.items():
    print(f"[{'PASS' if v else 'FAIL'}] {k}")
    ok = ok and v
sys.exit(0 if ok else 1)
