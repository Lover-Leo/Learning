# -*- coding: utf-8 -*-
"""GUI 冒烟测试: 真实创建 Tk 窗口, 模拟开局/落子/AI 回应/换边重开。"""
import chess
from chess_app import ChessApp

app = ChessApp()
results = {}


def step1():
    app.var_mode.set("pve")
    app.var_side.set("first")      # 玩家执白
    app.var_diff.set("medium")
    app._start_game()
    results["人机对局已开始"] = (app.mode == "pve"
                              and app.human_color == chess.WHITE
                              and app.bottom_color == chess.WHITE)


def step2():
    move = chess.Move.from_uci("e2e4")
    results["e4是合法走法"] = move in app.board.legal_moves
    app._commit_move(move)
    results["玩家落子成功"] = len(app.board.move_stack) == 1


def step3():
    results["AI已回应一步"] = len(app.board.move_stack) == 2
    results["轮到玩家"] = app.board.turn == chess.WHITE
    # 重开: 玩家执黑 -> 棋盘翻转, AI(白)自动先手
    app.var_side.set("second")
    app._restart()
    results["执黑时棋盘翻转"] = app.bottom_color == chess.BLACK


def step4():
    results["执黑时AI自动先手"] = (len(app.board.move_stack) == 1
                                and app.board.turn == chess.BLACK
                                and not app.ai_thinking)
    # 双人模式开一局验证状态
    app.var_mode.set("pvp")
    app.var_side.set("first")
    app._start_game()
    results["双人模式可开局"] = app.board.turn == chess.WHITE
    app.destroy()


app.after(300, step1)
app.after(700, step2)
app.after(3500, step3)
app.after(6500, step4)
app.mainloop()

ok = True
for k, v in results.items():
    print(f"[{'PASS' if v else 'FAIL'}] {k}")
    ok = ok and v
print("\nGUI 冒烟测试", "全部通过" if ok else "存在失败")
raise SystemExit(0 if ok else 1)
