# -*- coding: utf-8 -*-
"""国际象棋规则与内置 AI 的无头逻辑测试（不启动界面）。"""
import time
import chess
from chess_app import ChessAI

passed = []


def check(name, cond):
    status = "PASS" if cond else "FAIL"
    passed.append(cond)
    print(f"[{status}] {name}")
    assert cond, name


# 1. 初始局面合法走法数 = 20
b = chess.Board()
check("初始局面合法走法为20个", len(list(b.legal_moves)) == 20)

# 2. 愚者将杀 (Fool's mate): 1.f3 e5 2.g4 Qh4#
b = chess.Board()
for san in ("f3", "e5", "g4"):
    b.push_san(san)
mv = chess.Move.from_uci("d8h4")  # Qh4# (后从 d8 沿斜线到 h4)
check("Qh4 为合法走法", mv in b.legal_moves)
b.push_san("Qh4#")
check("愚者将杀被正确判定为将杀", b.is_checkmate() and b.is_game_over())

# 3. 王车易位: 短易位走法合法且记谱 O-O
b = chess.Board()
for san in ("e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"):
    b.push_san(san)
castles = [m for m in b.legal_moves if b.is_castling(m)]
check("短易位条件满足时存在易位走法", len(castles) >= 1)
check("短易位代数记谱为 O-O", b.san(castles[0]) == "O-O")

# 4. 吃过路兵: 1.a4 Nf6 2.a5 b5 后白方 a5xb6 e.p.
b = chess.Board()
b.push_san("a4")
b.push_san("Nf6")
b.push_san("a5")
b.push_san("b5")
ep = [m for m in b.legal_moves if b.is_en_passant(m)]
check("吃过路兵走法被识别", len(ep) == 1 and ep[0].uci() == "a5b6")

# 5. 逼和局面
b = chess.Board("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1")
check("经典局面判定为逼和", b.is_stalemate() and b.is_game_over()
      and not b.is_checkmate())

# 6. 兵升变走法完整（后/车/象/马四种）
b = chess.Board("7k/P7/7K/8/8/8/8/8 w - - 0 1")
prom = [m for m in b.legal_moves if m.from_square == chess.A7]
check("升变产生4种走法", len(prom) == 4
      and {m.promotion for m in prom} == {chess.QUEEN, chess.ROOK,
                                          chess.BISHOP, chess.KNIGHT})

# 7. 三档难度 AI 均返回合法走法
for diff in ("easy", "medium", "hard"):
    b = chess.Board()
    t0 = time.time()
    m = ChessAI.choose_move(b, diff)
    dt = time.time() - t0
    check(f"AI[{diff}] 返回合法走法 {m.uci()}（{dt:.2f}s）",
          m in b.legal_moves and dt < 30)

# 8. AI 会完成将杀：愚者将杀局面下，黑方(depth>=2)应能找到 Qh4#
b = chess.Board()
for san in ("f3", "e5", "g4"):
    b.push_san(san)
m = ChessAI.choose_move(b, "medium")
b.push(m)
check("中等AI能抓住一行将杀", b.is_checkmate())

# 9. AI 自对弈整局不产生非法走法；自动终局或满足提和条件(三次重复/五十回合)即结束
b = chess.Board()
moves_played = 0
ok = True
while not b.is_game_over() and not b.can_claim_draw() and moves_played < 300:
    m = ChessAI.choose_move(b, "medium")   # medium 无随机窗，自对弈确定性收敛
    if m not in b.legal_moves:
        ok = False
        break
    b.push(m)
    moves_played += 1
ended = b.is_game_over() or b.can_claim_draw()
check(f"AI自对弈{moves_played}步全程合法并终局/可提和", ok and ended)
print("终局原因: game_over=%s checkmate=%s stalemate=%s insufficient=%s claim_draw=%s"
      % (b.is_game_over(), b.is_checkmate(), b.is_stalemate(),
         b.is_insufficient_material(), b.can_claim_draw()))

# 10. 胜率映射锚点: +100≈65%, +300≈85%, 0=50%, -100≈35%
wp0 = ChessAI.win_pct(0)
wp100 = ChessAI.win_pct(100)
wp300 = ChessAI.win_pct(300)
check("胜率映射 0 分=50%", abs(wp0 - 50) < 0.1)
check("胜率映射 +100≈64%(锚点65)", 62 <= wp100 <= 67)
check("胜率映射 +300≈85%", 83 <= wp300 <= 87)
check("胜率映射 -100 与 +100 对称", abs(ChessAI.win_pct(-100) - (100 - wp100)) < 0.1)

# 11. 局面评估: 初始近均势；将杀局面给出极大分
b0 = chess.Board()
cp0 = ChessAI.evaluate_white_cp(b0)
check("初始局面分接近 0（|cp|<40）", abs(cp0) < 40)
bm = chess.Board()
for san in ("f3", "e5", "g4"):
    bm.push_san(san)
cp_mate = ChessAI.evaluate_white_cp(bm)   # 黑方下一步可 Qh4#
check("黑方一步将杀局面给出白方极低分", cp_mate < -900000)

# 12. 走法质量: 抓住将杀=最佳; 走废棋=大漏勺
best_move, best_score, loss_good, _ = ChessAI.analyze_move(bm, chess.Move.from_uci("d8h4"))
check("将杀走法分差损失为0", loss_good == 0 and best_score > 900000)
_, _, loss_bad, _ = ChessAI.analyze_move(bm, chess.Move.from_uci("a7a6"))
check("错过将杀走废棋损失巨大(>200)", loss_bad > 200)

# 13. 评估速度: 三个中局局面均在 1 秒内完成
fens = [
    "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
    "r2qk2r/ppp2ppp/2n1bn2/3pp3/1b2P3/1NN2N2/PPP2PPP/R1BQKB1R w KQkq d6 0 6",
    "2kr3r/pp3ppp/2p5/2Pp4/3P4/5q2/P4PPP/R1B2RK1 w - - 0 14",
]
fast = True
for fen in fens:
    t0 = time.time()
    ChessAI.evaluate_white_cp(chess.Board(fen))
    if time.time() - t0 > 1.0:
        fast = False
check("中局评估均在1秒内完成", fast)

print("\n%d/%d 项通过" % (sum(passed), len(passed)))
if not all(passed):
    raise SystemExit(1)
