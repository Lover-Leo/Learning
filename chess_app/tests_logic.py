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
    m = ChessAI.choose_move(b, "easy")
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

print("\n%d/%d 项通过" % (sum(passed), len(passed)))
if not all(passed):
    raise SystemExit(1)
