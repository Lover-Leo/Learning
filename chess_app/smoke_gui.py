# -*- coding: utf-8 -*-
"""GUI 冒烟测试: 皮肤/主题、落子、AI 回应、换边、人机悔棋回归（静音执行）。"""
import chess
from chess_app import ChessApp, PIECE_SKINS, BOARD_THEMES
from chess_sfx import SoundBoard

sb = SoundBoard(enabled=False)
expect_sounds = {"move", "capture", "castle", "select", "check",
                 "promote", "win", "lose", "draw"}
sound_ok = expect_sounds.issubset(set(sb._buf.keys())) if sb._buf else True

app = ChessApp()
app.var_sound.set(False)
app.sfx.enabled = False
results = {"音效缓冲齐全": sound_ok}


def step1():
    app.var_mode.set("pve")
    app.var_side.set("first")
    app.var_diff.set("medium")
    app.var_skin.set("classic3d")
    app.var_theme.set("green")
    app._start_game()
    results["立体皮肤开局渲染"] = (app.skin == "classic3d"
                              and len(app._img_cache) == 12)


def step2():
    app._commit_move(chess.Move.from_uci("e2e4"))
    results["玩家落子"] = len(app.board.move_stack) == 1


def step3():
    results["AI已回应"] = len(app.board.move_stack) == 2
    results["玩家走法已获质量标签"] = app.move_tags[0] is not None
    win_text = app.lbl_win_w.cget("text")
    results["胜率条已更新"] = "白方" in win_text and "%" in win_text
    ok = True
    for skin in PIECE_SKINS:
        app.var_skin_game.set(PIECE_SKINS[skin])
        app._apply_look_in_game()
        app.update()
        ok = ok and app.skin == skin
    for theme in BOARD_THEMES:
        app.var_theme_game.set(BOARD_THEMES[theme][5])
        app._apply_look_in_game()
        app.update()
        ok = ok and app.theme == theme
    results["三套皮肤四套主题切换无异常"] = ok


def step4():
    # 执白：AI 回应后轮到玩家，悔棋应撤掉 AI+玩家 两步
    results["悔棋前轮到玩家"] = app.board.turn == chess.WHITE
    app._undo()
    results["执白悔棋撤回到空局面"] = (len(app.board.move_stack) == 0
                                 and app.board.turn == chess.WHITE
                                 and len(app.san_list) == 0)
    app._commit_move(chess.Move.from_uci("d2d4"))
    results["悔棋后可重新落子"] = len(app.board.move_stack) == 1


def step5():
    results["AI再次回应"] = len(app.board.move_stack) == 2
    app._undo()
    results["第二次悔棋正常"] = len(app.board.move_stack) == 0
    # 改执黑重开：AI(白) 自动先手
    app.var_side.set("second")
    app.var_skin.set("wood3d")
    app._restart()
    results["执黑翻转且木纹生效"] = (app.bottom_color == chess.BLACK
                                and app.skin == "wood3d")


def step6():
    results["执黑时AI自动先手"] = (len(app.board.move_stack) == 1
                                and app.board.turn == chess.BLACK)
    # 玩家尚未走子就悔棋：撤掉 AI 开局后，AI 应重新自动开棋
    app._undo()
    results["执黑悔棋后局面清空"] = len(app.board.move_stack) == 0


def step7():
    results["执黑悔棋后AI重新先手"] = (len(app.board.move_stack) == 1
                                  and app.board.turn == chess.BLACK)
    # 双人 + 字符皮肤
    app.var_mode.set("pvp")
    app.var_side.set("first")
    app.var_skin.set("glyph")
    app._start_game()
    app._commit_move(chess.Move.from_uci("e2e4"))
    app._undo()
    results["双人悔棋正常"] = len(app.board.move_stack) == 0
    app.destroy()


app.after(300, step1)
app.after(700, step2)
app.after(3000, step3)
app.after(3500, step4)
app.after(5500, step5)
app.after(7500, step6)
app.after(9500, step7)
app.mainloop()

ok = True
for k, v in results.items():
    print(f"[{'PASS' if v else 'FAIL'}] {k}")
    ok = ok and v
print("\nGUI 冒烟测试", "全部通过" if ok else "存在失败")
raise SystemExit(0 if ok else 1)
