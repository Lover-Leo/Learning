# -*- coding: utf-8 -*-
"""
国际象棋对弈应用（单文件）
================================
规则引擎: python-chess —— 严格遵循国际象棋官方规则:
  合法走法判定、将军/将杀/逼和、王车易位、吃过路兵、兵升变、
  子力不足和棋、三次重复局面 / 五十回合规则可提和、
  五次重复 / 七十五回合自动和棋。
对弈模式:
  1) 双人本地对弈: 玩家1/玩家2 自由选择执白, 或系统随机分配
  2) 人机对弈:     玩家自行选择执白/执黑, 或系统随机; 内置三档难度 AI
外观: 三套棋子皮肤(立体经典/立体木纹/经典字符) × 四套棋盘主题; 走子音效。
界面: Tkinter 绘制, 立体棋子为内嵌 PNG 资源, 便于 PyInstaller 单文件打包。
"""

import base64
import random
import threading
import tkinter as tk
from tkinter import font as tkfont
from tkinter import messagebox

import chess

from chess_sfx import SoundBoard
from piece_assets import PIECE_B64

# ---------------------------------------------------------------------------
# 界面常量
# ---------------------------------------------------------------------------
SQ = 64                       # 每格像素
BOARD_PX = SQ * 8
COLOR_PANEL = "#F4F1E8"
FONT_UI = "Microsoft YaHei UI"
FONT_PIECE = "Segoe UI Symbol"

# 棋盘主题: (浅格, 深格, 上一步高亮, 选中高亮, 提示点)
BOARD_THEMES = {
    "green":  ("#EBECD0", "#779556", "#BACA44", "#F6F669", "#262626", "经典绿"),
    "wood":   ("#E8CFA0", "#A06E3C", "#D9B25E", "#F6DE73", "#3A2412", "胡桃木"),
    "slate":  ("#D8DFE8", "#5B7C99", "#8FB3D9", "#F2E27A", "#1E3A4D", "灰蓝"),
    "marble": ("#EFEDE7", "#8E8B86", "#CDBE86", "#F4E08A", "#333333", "云石灰"),
}
# 棋子皮肤
PIECE_SKINS = {
    "classic3d": "立体经典",
    "wood3d": "立体木纹",
    "glyph": "经典字符",
}
SKIN_ASSET = {"classic3d": "classic", "wood3d": "wood"}     # 对应 piece_assets 前缀
KIND_NAME = {chess.KING: "king", chess.QUEEN: "queen", chess.ROOK: "rook",
             chess.BISHOP: "bishop", chess.KNIGHT: "knight", chess.PAWN: "pawn"}
# 走法质量: 键 -> (中文名, 棋谱标记, 颜色)
QUALITY = {
    "brilliant": ("绝妙 !!", "!!", "#8E44AD"),
    "best": ("最佳 !", "!", "#2E7D32"),
    "good": ("好棋", "", "#6B8E23"),
    "normal": ("普通", "", "#888888"),
    "mistake": ("失误 ?!", "?!", "#E67E22"),
    "blunder": ("大漏勺 ??", "??", "#C0392B"),
}

# Unicode 棋子字形: (颜色, 棋子类型) -> 字符
GLYPH = {
    (chess.WHITE, chess.PAWN): "♙",
    (chess.WHITE, chess.KNIGHT): "♘",
    (chess.WHITE, chess.BISHOP): "♗",
    (chess.WHITE, chess.ROOK): "♖",
    (chess.WHITE, chess.QUEEN): "♕",
    (chess.WHITE, chess.KING): "♔",
    (chess.BLACK, chess.PAWN): "♟",
    (chess.BLACK, chess.KNIGHT): "♞",
    (chess.BLACK, chess.BISHOP): "♝",
    (chess.BLACK, chess.ROOK): "♜",
    (chess.BLACK, chess.QUEEN): "♛",
    (chess.BLACK, chess.KING): "♚",
}
PIECE_CN = {
    chess.KING: "王", chess.QUEEN: "后", chess.ROOK: "车",
    chess.BISHOP: "象", chess.KNIGHT: "马", chess.PAWN: "兵",
}
SIDE_CN = {chess.WHITE: "白方", chess.BLACK: "黑方"}


# ---------------------------------------------------------------------------
# 内置 AI: 子力 + 位置价值表, Negamax + Alpha-Beta 剪枝
# ---------------------------------------------------------------------------
class ChessAI:
    MATE = 1_000_000
    MATE_CP = 100_000                  # 胜率展示用的“必杀”截断分
    EVAL_DEPTH = 2                     # 实时评估搜索深度（保证 1 秒内出结果）
    NODE_CAP = 400_000                       # 单次思考节点上限, 保证界面响应
    VALUE = {
        chess.PAWN: 100, chess.KNIGHT: 320, chess.BISHOP: 330,
        chess.ROOK: 500, chess.QUEEN: 900, chess.KING: 20000,
    }
    # 位置价值表(PST), 索引按 a1=0 .. h8=63 (即 rank1 在表首), 白方视角;
    # 黑方使用 chess.square_mirror 镜像。
    PST = {
        chess.PAWN: [
            0, 0, 0, 0, 0, 0, 0, 0,
            5, 10, 10, -20, -20, 10, 10, 5,
            5, -5, -10, 0, 0, -10, -5, 5,
            0, 0, 0, 20, 20, 0, 0, 0,
            5, 5, 10, 25, 25, 10, 5, 5,
            10, 10, 20, 30, 30, 20, 10, 10,
            50, 50, 50, 50, 50, 50, 50, 50,
            0, 0, 0, 0, 0, 0, 0, 0,
        ],
        chess.KNIGHT: [
            -50, -40, -30, -30, -30, -30, -40, -50,
            -40, -20, 0, 5, 5, 0, -20, -40,
            -30, 5, 10, 15, 15, 10, 5, -30,
            -30, 0, 15, 20, 20, 15, 0, -30,
            -30, 5, 15, 20, 20, 15, 5, -30,
            -30, 0, 10, 15, 15, 10, 0, -30,
            -40, -20, 0, 0, 0, 0, -20, -40,
            -50, -40, -30, -30, -30, -30, -40, -50,
        ],
        chess.BISHOP: [
            -20, -10, -10, -10, -10, -10, -10, -20,
            -10, 5, 0, 0, 0, 0, 5, -10,
            -10, 10, 10, 10, 10, 10, 10, -10,
            -10, 0, 10, 10, 10, 10, 0, -10,
            -10, 5, 5, 10, 10, 5, 5, -10,
            -10, 0, 5, 10, 10, 5, 0, -10,
            -10, 0, 0, 0, 0, 0, 0, -10,
            -20, -10, -10, -10, -10, -10, -10, -20,
        ],
        chess.ROOK: [
            0, 0, 0, 5, 5, 0, 0, 0,
            -5, 0, 0, 0, 0, 0, 0, -5,
            -5, 0, 0, 0, 0, 0, 0, -5,
            -5, 0, 0, 0, 0, 0, 0, -5,
            -5, 0, 0, 0, 0, 0, 0, -5,
            -5, 0, 0, 0, 0, 0, 0, -5,
            5, 10, 10, 10, 10, 10, 10, 5,
            0, 0, 0, 0, 0, 0, 0, 0,
        ],
        chess.QUEEN: [
            -20, -10, -10, -5, -5, -10, -10, -20,
            -10, 0, 5, 0, 0, 0, 0, -10,
            -10, 5, 5, 5, 5, 5, 0, -10,
            0, 0, 5, 5, 5, 5, 0, -5,
            -5, 0, 5, 5, 5, 5, 0, -5,
            -10, 0, 5, 5, 5, 5, 0, -10,
            -10, 0, 0, 0, 0, 0, 0, -10,
            -20, -10, -10, -5, -5, -10, -10, -20,
        ],
        chess.KING: [
            20, 30, 10, 0, 0, 10, 30, 20,
            20, 20, 0, 0, 0, 0, 20, 20,
            -10, -20, -20, -20, -20, -20, -20, -10,
            -20, -30, -30, -40, -40, -30, -30, -20,
            -30, -40, -40, -50, -50, -40, -40, -30,
            -30, -40, -40, -50, -50, -40, -40, -30,
            -30, -40, -40, -50, -50, -40, -40, -30,
            -30, -40, -40, -50, -50, -40, -40, -30,
        ],
    }
    DIFFICULTY = {"easy": (1, 120), "medium": (2, 0), "hard": (3, 0)}

    # ---- 评估(白方视角, 单位: 厘兵分) ----
    @classmethod
    def evaluate(cls, board):
        score = 0
        for sq, piece in board.piece_map().items():
            idx = sq if piece.color == chess.WHITE else chess.square_mirror(sq)
            val = cls.VALUE[piece.piece_type] + cls.PST[piece.piece_type][idx]
            score += val if piece.color == chess.WHITE else -val
        return score

    @classmethod
    def _ordered_moves(cls, board):
        """吃子/升变优先(MVV-LVA), 提升剪枝效率。"""
        def score(move):
            s = 0
            if move.promotion:
                s += 900 + cls.VALUE.get(move.promotion, 0)
            victim = board.piece_at(move.to_square)
            if victim is None and board.is_en_passant(move):
                victim = chess.Piece(chess.PAWN, not board.turn)
            attacker = board.piece_at(move.from_square)
            if victim is not None:
                s += cls.VALUE[victim.piece_type]
                if attacker is not None:
                    s -= cls.VALUE[attacker.piece_type] // 10
            return s
        moves = list(board.legal_moves)
        moves.sort(key=score, reverse=True)
        return moves

    @classmethod
    def _negamax(cls, board, depth, alpha, beta, nodes):
        """返回当前行棋方视角的局面分。"""
        nodes[0] += 1
        if board.is_checkmate():                       # 当前方被将杀
            return -cls.MATE - depth
        if board.is_game_over():                       # 其他和棋
            return 0
        if depth == 0:
            e = cls.evaluate(board)
            return e if board.turn == chess.WHITE else -e
        best = -cls.MATE * 2
        for move in cls._ordered_moves(board):
            board.push(move)
            sc = -cls._negamax(board, depth - 1, -beta, -alpha, nodes)
            board.pop()
            if sc > best:
                best = sc
            if best > alpha:
                alpha = best
            if alpha >= beta or nodes[0] > cls.NODE_CAP:
                break
        return best

    @classmethod
    def _root_search(cls, board, depth):
        """根层搜索: 返回 [(move, 行棋方视角分)...]，吃子优先排序。"""
        nodes = [0]
        scored = []
        alpha = -cls.MATE * 2
        for move in cls._ordered_moves(board):
            board.push(move)
            sc = -cls._negamax(board, depth - 1, -cls.MATE * 2, -alpha, nodes)
            board.pop()
            scored.append((move, sc))
            if sc > alpha:
                alpha = sc
        return scored

    @staticmethod
    def win_pct(cp):
        """Elo logistic: centipawn -> 白方胜率%。
        校准锚点: +100≈64%、+300≈85%、0=50%、-100≈36%。"""
        x = max(-10000.0, min(10000.0, cp)) / 400.0
        return 100.0 / (1.0 + 10.0 ** (-x))

    @classmethod
    def evaluate_white_cp(cls, board, depth=None):
        """当前局面的白方视角 centipawn 分（将杀截断为 ±MATE_CP，和棋 0）。"""
        depth = cls.EVAL_DEPTH if depth is None else depth
        if board.is_checkmate():
            return -cls.MATE_CP if board.turn == chess.WHITE else cls.MATE_CP
        if board.is_game_over():
            return 0
        nodes = [0]
        s = cls._negamax(board, depth, -cls.MATE * 2, cls.MATE * 2, nodes)
        return s if board.turn == chess.WHITE else -s

    @classmethod
    def analyze_move(cls, pre_board, move, depth=None):
        """对比玩家走法与引擎最优走法。
        返回 (最佳走法, 最佳分[行棋方], 分差损失cp, 走完后白方视角cp)。"""
        depth = cls.EVAL_DEPTH if depth is None else depth
        scored = cls._root_search(pre_board, depth)
        best_move, best_score = max(scored, key=lambda x: x[1])
        pre_board.push(move)
        after_cp = cls.evaluate_white_cp(pre_board, depth)
        nodes = [0]
        played_score = -cls._negamax(pre_board, depth - 1,
                                     -cls.MATE * 2, cls.MATE * 2, nodes)
        pre_board.pop()
        loss = max(0, best_score - played_score)
        return best_move, best_score, loss, after_cp

    @classmethod
    def choose_move(cls, board, difficulty):
        """难度: easy=1层+随机性, medium=2层, hard=3层。返回一个合法走法。"""
        moves = list(board.legal_moves)
        if not moves:
            return None
        if len(moves) == 1:
            return moves[0]
        depth, window = cls.DIFFICULTY.get(difficulty, (2, 0))
        scored = cls._root_search(board, depth)
        best = max(s for _m, s in scored)
        if window:                                     # 简单难度: 近优走法中随机
            candidates = [m for m, s in scored if s >= best - window]
        else:
            candidates = [m for m, s in scored if s == best]
        return random.choice(candidates)


# ---------------------------------------------------------------------------
# 兵升变选择对话框
# ---------------------------------------------------------------------------
class PromotionDialog(tk.Toplevel):
    def __init__(self, master, color):
        super().__init__(master)
        self.title("兵升变")
        self.resizable(False, False)
        self.result = None
        self.configure(bg=COLOR_PANEL)
        tk.Label(self, text="请选择升变棋子：", bg=COLOR_PANEL,
                 font=(FONT_UI, 11)).pack(padx=16, pady=(14, 6))
        bar = tk.Frame(self, bg=COLOR_PANEL)
        bar.pack(padx=16, pady=(0, 14))
        big = tkfont.Font(family=FONT_PIECE, size=30)
        for i, pt in enumerate((chess.QUEEN, chess.ROOK, chess.BISHOP, chess.KNIGHT)):
            tk.Button(bar, text=GLYPH[(color, pt)], font=big, width=2,
                      command=lambda pt=pt: self._choose(pt)).grid(row=0, column=i, padx=4)
        self.protocol("WM_DELETE_WINDOW", self._cancel)
        self.transient(master)
        self.grab_set()
        self.update_idletasks()
        x = master.winfo_rootx() + 180
        y = master.winfo_rooty() + 220
        self.geometry(f"+{x}+{y}")
        master.wait_window(self)

    def _choose(self, pt):
        self.result = pt
        self.destroy()

    def _cancel(self):
        self.result = None
        self.destroy()


# ---------------------------------------------------------------------------
# 主应用
# ---------------------------------------------------------------------------
class ChessApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("国际象棋对弈")
        self.resizable(False, False)
        self.configure(bg=COLOR_PANEL)
        for name in ("TkDefaultFont", "TkTextFont", "TkMenuFont"):
            try:
                tkfont.nametofont(name).configure(family=FONT_UI, size=10)
            except tk.TclError:
                pass
        self._piece_font = tkfont.Font(family=FONT_PIECE, size=34)
        self._coord_font = tkfont.Font(family="Consolas", size=8, weight="bold")

        self.menu_frame = tk.Frame(self, bg=COLOR_PANEL)
        self.game_frame = tk.Frame(self, bg=COLOR_PANEL)

        # 对局状态
        self.board = chess.Board()
        self.mode = "pvp"                # pvp / pve
        self.diff = "medium"
        self.human_color = chess.WHITE   # pve 中玩家执棋颜色
        self.bottom_color = chess.WHITE  # 棋盘下方显示哪一方
        self.selected = None
        self.legal_targets = {}          # to_square -> [Move]
        self.san_list = []
        self.move_tags = []              # 与 san_list 平行的走法质量标签（AI 走法为 None）
        self.last_move = None
        self.game_over = False
        self.result_text = ""
        self.ai_color = chess.BLACK
        self.ai_thinking = False
        self._ai_result = None
        self._ai_token = 0
        self._analysis_token = 0         # 评估任务令牌（悔棋/新局使其失效）
        self._analysis_busy = False
        self.last_cp = 0

        # 外观与音效
        self.skin = "classic3d"
        self.theme = "green"
        self.var_sound = tk.BooleanVar(value=True)
        self.sfx = SoundBoard(enabled=True)
        self._img_cache = {}                 # (皮肤, 颜色, 类型) -> PhotoImage

        self._build_menu()
        self._build_game()
        self._show_menu()

    # ---------------- 主菜单 ----------------
    def _build_menu(self):
        f = self.menu_frame
        for child in f.winfo_children():
            child.destroy()
        self.var_mode = tk.StringVar(value="pvp")
        self.var_side = tk.StringVar(value="random")
        self.var_diff = tk.StringVar(value="medium")
        self.var_skin = tk.StringVar(value="classic3d")
        self.var_theme = tk.StringVar(value="green")

        tk.Label(f, text="国际象棋对弈", font=(FONT_UI, 24, "bold"),
                 bg=COLOR_PANEL, fg="#2F4F2F").pack(pady=(34, 4))
        tk.Label(f, text="严格遵循国际象棋官方规则 · python-chess 规则引擎",
                 font=(FONT_UI, 9), bg=COLOR_PANEL, fg="#666").pack(pady=(0, 22))

        box1 = tk.LabelFrame(f, text="对弈模式", font=(FONT_UI, 11, "bold"),
                             bg=COLOR_PANEL, fg="#333", padx=18, pady=10)
        box1.pack(fill="x", padx=46, pady=6)
        tk.Radiobutton(box1, text="双人对弈（同一台电脑两人轮流落子）",
                       variable=self.var_mode, value="pvp", bg=COLOR_PANEL,
                       activebackground=COLOR_PANEL, command=self._refresh_side_options,
                       font=(FONT_UI, 10)).pack(anchor="w", pady=2)
        tk.Radiobutton(box1, text="人机对弈（你与内置电脑 AI 对弈）",
                       variable=self.var_mode, value="pve", bg=COLOR_PANEL,
                       activebackground=COLOR_PANEL, command=self._refresh_side_options,
                       font=(FONT_UI, 10)).pack(anchor="w", pady=2)

        self.box_side = tk.LabelFrame(f, text="执白 / 执黑选择",
                                      font=(FONT_UI, 11, "bold"),
                                      bg=COLOR_PANEL, fg="#333", padx=18, pady=10)
        self.box_side.pack(fill="x", padx=46, pady=6)
        self.rb_side_1 = tk.Radiobutton(self.box_side, variable=self.var_side,
                                        value="first", bg=COLOR_PANEL,
                                        activebackground=COLOR_PANEL,
                                        font=(FONT_UI, 10))
        self.rb_side_1.pack(anchor="w", pady=2)
        self.rb_side_2 = tk.Radiobutton(self.box_side, variable=self.var_side,
                                        value="second", bg=COLOR_PANEL,
                                        activebackground=COLOR_PANEL,
                                        font=(FONT_UI, 10))
        self.rb_side_2.pack(anchor="w", pady=2)
        tk.Radiobutton(self.box_side, text="系统随机分配", variable=self.var_side,
                       value="random", bg=COLOR_PANEL, activebackground=COLOR_PANEL,
                       font=(FONT_UI, 10)).pack(anchor="w", pady=2)

        self.box_diff = tk.LabelFrame(f, text="电脑 AI 难度（仅人机对弈）",
                                      font=(FONT_UI, 11, "bold"),
                                      bg=COLOR_PANEL, fg="#333", padx=18, pady=10)
        self.box_diff.pack(fill="x", padx=46, pady=6)
        diff_row = tk.Frame(self.box_diff, bg=COLOR_PANEL)
        diff_row.pack(anchor="w")
        for val, txt in (("easy", "简单"), ("medium", "中等"), ("hard", "困难")):
            tk.Radiobutton(diff_row, text=txt, variable=self.var_diff, value=val,
                           bg=COLOR_PANEL, activebackground=COLOR_PANEL,
                           font=(FONT_UI, 10)).pack(side="left", padx=(0, 18))

        box_look = tk.LabelFrame(f, text="棋子皮肤 / 棋盘主题 / 音效",
                                 font=(FONT_UI, 11, "bold"),
                                 bg=COLOR_PANEL, fg="#333", padx=18, pady=10)
        box_look.pack(fill="x", padx=46, pady=6)
        skin_row = tk.Frame(box_look, bg=COLOR_PANEL)
        skin_row.pack(anchor="w")
        tk.Label(skin_row, text="棋子：", bg=COLOR_PANEL,
                 font=(FONT_UI, 10)).pack(side="left")
        for val, txt in PIECE_SKINS.items():
            tk.Radiobutton(skin_row, text=txt, variable=self.var_skin, value=val,
                           bg=COLOR_PANEL, activebackground=COLOR_PANEL,
                           font=(FONT_UI, 10),
                           command=self._apply_look_from_menu).pack(side="left",
                                                                    padx=(0, 10))
        theme_row = tk.Frame(box_look, bg=COLOR_PANEL)
        theme_row.pack(anchor="w", pady=(4, 0))
        tk.Label(theme_row, text="棋盘：", bg=COLOR_PANEL,
                 font=(FONT_UI, 10)).pack(side="left")
        for val, (_, _, _, _, _, txt) in BOARD_THEMES.items():
            tk.Radiobutton(theme_row, text=txt, variable=self.var_theme, value=val,
                           bg=COLOR_PANEL, activebackground=COLOR_PANEL,
                           font=(FONT_UI, 10),
                           command=self._apply_look_from_menu).pack(side="left",
                                                                    padx=(0, 10))
        tk.Checkbutton(box_look, text="开启走子音效（走子、吃子、将军、升变、终局）",
                       variable=self.var_sound, bg=COLOR_PANEL,
                       activebackground=COLOR_PANEL,
                       command=self._toggle_sound,
                       font=(FONT_UI, 10)).pack(anchor="w", pady=(6, 0))

        tk.Button(f, text="开 始 对 弈", font=(FONT_UI, 14, "bold"),
                  bg="#5B8C3E", fg="white", activebackground="#4A7532",
                  activeforeground="white", relief="flat", width=16, pady=8,
                  command=self._start_game).pack(pady=20)
        self._refresh_side_options()

    def _apply_look_from_menu(self):
        self.skin = self.var_skin.get()
        self.theme = self.var_theme.get()
        self.sfx.enabled = self.var_sound.get()
        if hasattr(self, "var_skin_game"):
            self.var_skin_game.set(PIECE_SKINS[self.skin])
            self.var_theme_game.set(BOARD_THEMES[self.theme][5])

    def _apply_look_in_game(self):
        label_to_skin = {v: k for k, v in PIECE_SKINS.items()}
        label_to_theme = {v[5]: k for k, v in BOARD_THEMES.items()}
        self.skin = label_to_skin[self.var_skin_game.get()]
        self.theme = label_to_theme[self.var_theme_game.get()]
        self.var_skin.set(self.skin)
        self.var_theme.set(self.theme)
        self._redraw()

    def _toggle_sound(self):
        self.sfx.enabled = self.var_sound.get()
        if self.sfx.enabled:
            self.sfx.play("select")

    def _get_piece_image(self, color, piece_type):
        """立体皮肤：从内嵌 base64 取 PNG（缓存 PhotoImage，避免重复解码）。"""
        key = (self.skin, color, piece_type)
        img = self._img_cache.get(key)
        if img is None:
            prefix = SKIN_ASSET[self.skin]
            c = "w" if color == chess.WHITE else "b"
            asset_key = f"{prefix}_{c}_{KIND_NAME[piece_type]}"
            img = tk.PhotoImage(data=base64.b64decode(PIECE_B64[asset_key]))
            self._img_cache[key] = img
        return img

    def _refresh_side_options(self):
        is_pve = self.var_mode.get() == "pve"
        if is_pve:
            self.rb_side_1.config(text="我执白（先手，电脑执黑）")
            self.rb_side_2.config(text="我执黑（后手，电脑执白）")
        else:
            self.rb_side_1.config(text="玩家1执白（先手），玩家2执黑")
            self.rb_side_2.config(text="玩家2执白（先手），玩家1执黑")
        state = "normal" if is_pve else "disabled"
        for child in self.box_diff.winfo_children():
            for rb in child.winfo_children():
                rb.config(state=state)

    def _show_menu(self):
        self.game_frame.pack_forget()
        self.menu_frame.pack(fill="both", expand=True)
        self.geometry("480x736")

    # ---------------- 对局界面 ----------------
    def _build_game(self):
        f = self.game_frame
        self.canvas = tk.Canvas(f, width=BOARD_PX, height=BOARD_PX,
                                highlightthickness=0, bd=0)
        self.canvas.bind("<Button-1>", self._on_canvas_click)
        self.canvas.grid(row=0, column=0, rowspan=2, padx=(12, 8), pady=12)

        side = tk.Frame(f, bg=COLOR_PANEL, width=236)
        side.grid(row=0, column=1, sticky="n", pady=12, padx=(0, 12))
        side.grid_propagate(False)

        self.lbl_title = tk.Label(side, font=(FONT_UI, 11, "bold"),
                                  bg=COLOR_PANEL, fg="#2F4F2F", wraplength=220,
                                  justify="left")
        self.lbl_title.pack(anchor="w")
        self.lbl_status = tk.Label(side, font=(FONT_UI, 12, "bold"),
                                   bg=COLOR_PANEL, fg="#B23A2E", wraplength=220,
                                   justify="left")
        self.lbl_status.pack(anchor="w", pady=(8, 4))
        self.lbl_capture = tk.Label(side, font=(FONT_UI, 9), bg=COLOR_PANEL,
                                    fg="#444", wraplength=220, justify="left")
        self.lbl_capture.pack(anchor="w", pady=(0, 6))

        # 胜率评估
        eval_box = tk.Frame(side, bg=COLOR_PANEL)
        eval_box.pack(fill="x", pady=(0, 4))
        tk.Label(eval_box, text="胜率评估", font=(FONT_UI, 9, "bold"),
                 bg=COLOR_PANEL, fg="#333").pack(anchor="w")
        wr = tk.Frame(eval_box, bg=COLOR_PANEL)
        wr.pack(fill="x")
        self.lbl_win_w = tk.Label(wr, text="白方 50.0%", font=(FONT_UI, 8),
                                  bg=COLOR_PANEL, fg="#333")
        self.lbl_win_w.pack(side="left")
        self.lbl_win_b = tk.Label(wr, text="黑方 50.0%", font=(FONT_UI, 8),
                                  bg=COLOR_PANEL, fg="#333")
        self.lbl_win_b.pack(side="right")
        self.can_eval = tk.Canvas(eval_box, width=220, height=18,
                                  highlightthickness=1,
                                  highlightbackground="#AAA08A")
        self.can_eval.pack(fill="x", pady=2)
        self.lbl_eval_cp = tk.Label(eval_box, text="局面分 0.00（均势）",
                                    font=(FONT_UI, 8), bg=COLOR_PANEL, fg="#555")
        self.lbl_eval_cp.pack(anchor="w")
        self.lbl_your_win = tk.Label(eval_box, text="", font=(FONT_UI, 9, "bold"),
                                     bg=COLOR_PANEL, fg="#2F4F2F")
        self.lbl_your_win.pack(anchor="w")
        self.lbl_quality = tk.Label(eval_box, text="", font=(FONT_UI, 10, "bold"),
                                    bg=COLOR_PANEL, wraplength=220, justify="left")
        self.lbl_quality.pack(anchor="w", pady=(2, 0))

        hist_frame = tk.Frame(side, bg="#EEE9DC")
        hist_frame.pack(fill="x")
        tk.Label(hist_frame, text="棋谱（代数记谱）", font=(FONT_UI, 9, "bold"),
                 bg="#EEE9DC").pack(anchor="w", padx=4, pady=(4, 0))
        self.txt_hist = tk.Text(hist_frame, width=26, height=9,
                                font=("Consolas", 10), bg="#FFFEF7",
                                relief="flat", wrap="none")
        self.txt_hist.pack(side="left", fill="both", expand=True, padx=(4, 0), pady=4)
        sb = tk.Scrollbar(hist_frame, command=self.txt_hist.yview)
        sb.pack(side="right", fill="y")
        self.txt_hist.config(yscrollcommand=sb.set, state="disabled")

        look = tk.Frame(side, bg=COLOR_PANEL)
        look.pack(fill="x", pady=(8, 0))
        self.var_skin_game = tk.StringVar(value=PIECE_SKINS[self.skin])
        theme_labels = {v[5]: k for k, v in BOARD_THEMES.items()}
        self.var_theme_game = tk.StringVar(
            value=BOARD_THEMES[self.theme][5])
        menu_skin = tk.OptionMenu(look, self.var_skin_game, *PIECE_SKINS.values(),
                                  command=lambda _v: self._apply_look_in_game())
        menu_theme = tk.OptionMenu(look, self.var_theme_game, *theme_labels,
                                   command=lambda _v: self._apply_look_in_game())
        menu_skin.config(font=(FONT_UI, 9), relief="flat", bg="#E7E1D2",
                         activebackground="#D6CFBB", width=8)
        menu_theme.config(font=(FONT_UI, 9), relief="flat", bg="#E7E1D2",
                          activebackground="#D6CFBB", width=7)
        menu_skin.grid(row=0, column=0, padx=(0, 4), sticky="w")
        menu_theme.grid(row=0, column=1, padx=(0, 4), sticky="w")
        tk.Checkbutton(look, text="音效", variable=self.var_sound,
                       bg=COLOR_PANEL, activebackground=COLOR_PANEL,
                       font=(FONT_UI, 9),
                       command=self._toggle_sound).grid(row=0, column=2, sticky="w")
        tk.Button(look, text="试听", font=(FONT_UI, 8), relief="flat",
                  bg="#D9D3C2", activebackground="#C7C0AC",
                  command=lambda: self.sfx.demo()).grid(row=0, column=3, padx=(4, 0))

        btns = tk.Frame(side, bg=COLOR_PANEL)
        btns.pack(fill="x", pady=10)
        opts = {"font": (FONT_UI, 10), "relief": "flat", "pady": 5,
                "bg": "#D9D3C2", "activebackground": "#C7C0AC"}
        tk.Button(btns, text="新对局", command=self._restart, **opts).grid(
            row=0, column=0, sticky="ew", padx=2, pady=2)
        tk.Button(btns, text="悔棋", command=self._undo, **opts).grid(
            row=0, column=1, sticky="ew", padx=2, pady=2)
        self.btn_draw = tk.Button(btns, text="提和", command=self._claim_draw, **opts)
        self.btn_draw.grid(row=1, column=0, sticky="ew", padx=2, pady=2)
        tk.Button(btns, text="认输", command=self._resign, **opts).grid(
            row=1, column=1, sticky="ew", padx=2, pady=2)
        tk.Button(btns, text="返回主菜单", command=self._back_to_menu, **opts).grid(
            row=2, column=0, columnspan=2, sticky="ew", padx=2, pady=2)
        btns.grid_columnconfigure(0, weight=1)
        btns.grid_columnconfigure(1, weight=1)

    # ---------------- 对局流程 ----------------
    def _start_game(self):
        self.mode = self.var_mode.get()
        self.diff = self.var_diff.get()
        self.skin = self.var_skin.get()
        self.theme = self.var_theme.get()
        self.sfx.enabled = self.var_sound.get()
        self.var_skin_game.set(PIECE_SKINS[self.skin])
        self.var_theme_game.set(BOARD_THEMES[self.theme][5])
        side_choice = self.var_side.get()
        if self.mode == "pve":
            if side_choice == "first":
                self.human_color = chess.WHITE
            elif side_choice == "second":
                self.human_color = chess.BLACK
            else:
                self.human_color = random.choice([chess.WHITE, chess.BLACK])
            self.ai_color = not self.human_color
            self.bottom_color = self.human_color
            diff_cn = {"easy": "简单", "medium": "中等", "hard": "困难"}[self.diff]
            self.lbl_title.config(
                text=f"人机对弈 · 你执{SIDE_CN[self.human_color]} · "
                     f"{diff_cn}难度\n白方先行")
        else:
            if side_choice == "second":
                p1_color = chess.BLACK
            elif side_choice == "first":
                p1_color = chess.WHITE
            else:
                p1_color = random.choice([chess.WHITE, chess.BLACK])
            self.p1_color = p1_color
            self.bottom_color = chess.WHITE
            self.human_color = None
            self.ai_color = None
            self.lbl_title.config(
                text=f"双人对弈 · 玩家1执{SIDE_CN[p1_color]}，"
                     f"玩家2执{SIDE_CN[not p1_color]}\n白方先行")
        self._reset_board()
        self.menu_frame.pack_forget()
        self.game_frame.pack(fill="both", expand=True)
        self.geometry("792x606")
        self._maybe_ai_turn()

    def _restart(self):
        # 保留模式/难度; 按当前选边设置重新开局（随机则重新随机）
        self.skin = self.var_skin.get()
        self.theme = self.var_theme.get()
        self.sfx.enabled = self.var_sound.get()
        self.var_skin_game.set(PIECE_SKINS[self.skin])
        self.var_theme_game.set(BOARD_THEMES[self.theme][5])
        choice = self.var_side.get()
        if self.mode == "pve":
            if choice == "first":
                self.human_color = chess.WHITE
            elif choice == "second":
                self.human_color = chess.BLACK
            else:
                self.human_color = random.choice([chess.WHITE, chess.BLACK])
            self.ai_color = not self.human_color
            self.bottom_color = self.human_color
            diff_cn = {"easy": "简单", "medium": "中等", "hard": "困难"}[self.diff]
            self.lbl_title.config(
                text=f"人机对弈 · 你执{SIDE_CN[self.human_color]} · "
                     f"{diff_cn}难度\n白方先行")
        else:
            if choice == "first":
                self.p1_color = chess.WHITE
            elif choice == "second":
                self.p1_color = chess.BLACK
            else:
                self.p1_color = random.choice([chess.WHITE, chess.BLACK])
            self.bottom_color = chess.WHITE
            self.lbl_title.config(
                text=f"双人对弈 · 玩家1执{SIDE_CN[self.p1_color]}，"
                     f"玩家2执{SIDE_CN[not self.p1_color]}\n白方先行")
        self._reset_board()
        self._maybe_ai_turn()

    def _reset_board(self):
        self._ai_token += 1
        self._analysis_token += 1
        self._analysis_busy = False
        self.board = chess.Board()
        self.selected = None
        self.legal_targets = {}
        self.san_list = []
        self.move_tags = []
        self.last_move = None
        self.game_over = False
        self.result_text = ""
        self.ai_thinking = False
        self._ai_result = None
        self.last_cp = 0
        self.lbl_quality.config(text="")
        self._redraw()
        self._update_panel()
        self._render_eval(0.0)

    def _back_to_menu(self):
        self._ai_token += 1
        self._analysis_token += 1
        self.ai_thinking = False
        self._show_menu()

    # ---- 坐标换算（支持棋盘翻转）----
    def _sq_center(self, sq):
        f = chess.square_file(sq)
        r = chess.square_rank(sq)
        if self.bottom_color == chess.WHITE:
            col, row = f, 7 - r
        else:
            col, row = 7 - f, r
        return col * SQ + SQ // 2, row * SQ + SQ // 2

    def _xy_to_sq(self, x, y):
        col, row = x // SQ, y // SQ
        if not (0 <= col < 8 and 0 <= row < 8):
            return None
        if self.bottom_color == chess.WHITE:
            f, r = col, 7 - row
        else:
            f, r = 7 - col, row
        return chess.square(f, r)

    # ---- 绘制 ----
    def _redraw(self):
        cv = self.canvas
        cv.delete("all")
        c_light, c_dark, c_last, c_select, c_dot, _ = BOARD_THEMES[self.theme]
        for sq in range(64):
            f = chess.square_file(sq)
            r = chess.square_rank(sq)
            cx, cy = self._sq_center(sq)
            x0, y0 = cx - SQ // 2, cy - SQ // 2
            fill = c_light if (f + r) % 2 == 0 else c_dark
            if self.last_move and sq in (self.last_move.from_square,
                                         self.last_move.to_square):
                fill = c_last
            if sq == self.selected:
                fill = c_select
            cv.create_rectangle(x0, y0, x0 + SQ, y0 + SQ, fill=fill, outline="")
            # 边缘坐标
            tag_color = c_dark if (f + r) % 2 == 0 else c_light
            edge_col = 0 if self.bottom_color == chess.WHITE else 7
            edge_row = 7 if self.bottom_color == chess.WHITE else 0
            if f == edge_col:
                cv.create_text(x0 + 7, y0 + 8, text=str(r + 1),
                               font=self._coord_font, fill=tag_color, anchor="nw")
            if r == edge_row:
                cv.create_text(x0 + SQ - 6, y0 + SQ - 8,
                               text=chr(ord("a") + f),
                               font=self._coord_font, fill=tag_color, anchor="se")

        # 合法落点提示
        if self.selected is not None:
            for target in self.legal_targets:
                cx, cy = self._sq_center(target)
                if self.board.piece_at(target) is not None or self._is_ep_target(
                        self.selected, target):
                    cv.create_oval(cx - 28, cy - 28, cx + 28, cy + 28,
                                   outline=c_dot, width=3)
                else:
                    cv.create_oval(cx - 9, cy - 9, cx + 9, cy + 9,
                                   fill=c_dot, outline="")

        # 棋子：立体 PNG 皮肤 或 经典字符
        use_image = self.skin in SKIN_ASSET
        for sq, piece in self.board.piece_map().items():
            cx, cy = self._sq_center(sq)
            if use_image:
                img = self._get_piece_image(piece.color, piece.piece_type)
                cv.create_image(cx, cy, image=img, anchor="center")
                continue
            glyph = GLYPH[(piece.color, piece.piece_type)]
            if piece.color == chess.WHITE:                       # 白字黑描边
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    cv.create_text(cx + dx, cy + dy, text=glyph,
                                   fill="#333333", font=self._piece_font)
                cv.create_text(cx, cy, text=glyph, fill="#FAFAFA",
                               font=self._piece_font)
            else:
                cv.create_text(cx, cy, text=glyph, fill="#1C1C1C",
                               font=self._piece_font)

    def _is_ep_target(self, from_sq, to_sq):
        for m in self.board.legal_moves:
            if (m.from_square == from_sq and m.to_square == to_sq
                    and self.board.is_en_passant(m)):
                return True
        return False

    # ---- 鼠标落子 ----
    def _on_canvas_click(self, event):
        if self.game_over or self.ai_thinking:
            return
        if not self._is_human_turn():
            return
        sq = self._xy_to_sq(event.x, event.y)
        if sq is None:
            return
        piece = self.board.piece_at(sq)

        if self.selected is None:
            if piece is not None and piece.color == self.board.turn:
                self._select(sq)
            return

        if sq == self.selected:
            self._clear_selection()
            return

        moves = self.legal_targets.get(sq)
        if moves:
            move = moves[0]
            if len(moves) > 1:                                # 兵升变多选
                choice = PromotionDialog(self, self.board.turn).result
                if choice is None:
                    self._clear_selection()
                    return
                move = next(m for m in moves if m.promotion == choice)
            self._commit_move(move)
            return

        if piece is not None and piece.color == self.board.turn:
            self._select(sq)
        else:
            self._clear_selection()

    def _select(self, sq):
        self.selected = sq
        self.legal_targets = {}
        for m in self.board.legal_moves:
            if m.from_square == sq:
                self.legal_targets.setdefault(m.to_square, []).append(m)
        self.sfx.play("select")
        self._redraw()

    def _play_move_sound(self, is_capture, is_castle, is_promotion):
        if self.board.is_check():
            self.sfx.play("check")
        elif is_promotion:
            self.sfx.play("promote")
        elif is_castle:
            self.sfx.play("castle")
        elif is_capture:
            self.sfx.play("capture")
        else:
            self.sfx.play("move")

    def _clear_selection(self):
        self.selected = None
        self.legal_targets = {}
        self._redraw()

    def _is_human_turn(self):
        if self.mode == "pvp":
            return not self.game_over
        return self.board.turn == self.human_color

    def _commit_move(self, move):
        is_capture = self.board.is_capture(move)
        is_castle = self.board.is_castling(move)
        is_promotion = bool(move.promotion)
        pre_copy = self.board.copy()
        san = self.board.san(move)
        self.board.push(move)
        self.san_list.append(san)
        self.move_tags.append(None)
        self.last_move = move
        self._clear_selection()
        self._update_panel()
        self._request_analysis(pre_copy, move, human_move=True)
        if self._check_game_end():
            return
        self._play_move_sound(is_capture, is_castle, is_promotion)
        self._maybe_ai_turn()

    # ---- AI ----
    def _maybe_ai_turn(self):
        if self.mode != "pve" or self.game_over:
            return
        if self.board.turn != self.ai_color:
            self._update_panel()
            return
        self.ai_thinking = True
        self._ai_result = None
        token = self._ai_token
        board_copy = self.board.copy()
        difficulty = self.diff

        def worker():
            mv = ChessAI.choose_move(board_copy, difficulty)
            if token == self._ai_token:
                self._ai_result = mv

        threading.Thread(target=worker, daemon=True).start()
        self._update_panel()
        self.after(120, lambda: self._poll_ai(token))

    def _poll_ai(self, token):
        if token != self._ai_token:
            return
        if self._ai_result is None:
            if self.ai_thinking:
                self.after(120, lambda: self._poll_ai(token))
            return
        self.ai_thinking = False
        move = self._ai_result
        if move in self.board.legal_moves:
            is_capture = self.board.is_capture(move)
            is_castle = self.board.is_castling(move)
            is_promotion = bool(move.promotion)
            san = self.board.san(move)
            self.board.push(move)
            self.san_list.append(san)
            self.move_tags.append(None)
            self.last_move = move
            self._redraw()
            self._update_panel()
            self._request_analysis(None, None, human_move=False)
            if not self._check_game_end():
                self._play_move_sound(is_capture, is_castle, is_promotion)
                self._update_panel()
        else:                                                    # 兜底, 理论不可达
            self.ai_thinking = False
            self._update_panel()

    # ---- 胜率评估与走法质量 ----
    @staticmethod
    def _is_sacrifice(pre_board, move):
        """用高价值子去换低价值子（近似“弃子”判定）。"""
        if not pre_board.is_capture(move):
            return False
        attacker = pre_board.piece_at(move.from_square)
        victim = pre_board.piece_at(move.to_square)
        if victim is None and pre_board.is_en_passant(move):
            victim = chess.Piece(chess.PAWN, not pre_board.turn)
        if attacker is None or victim is None:
            return False
        return ChessAI.VALUE[attacker.piece_type] > \
            ChessAI.VALUE[victim.piece_type] + 100

    @staticmethod
    def _quality_tag(loss, brilliant):
        if brilliant:
            return "brilliant"
        if loss <= 20:
            return "best"
        if loss <= 50:
            return "good"
        if loss <= 100:
            return "normal"
        if loss <= 200:
            return "mistake"
        return "blunder"

    def _request_analysis(self, pre_board, played_move, human_move):
        self._analysis_token += 1
        token = self._analysis_token
        self._analysis_result = None
        depth = ChessAI.EVAL_DEPTH
        post_copy = self.board.copy()

        def worker():
            result = {}
            if human_move and pre_board is not None:
                sacrifice = self._is_sacrifice(pre_board, played_move)
                best_move, best_score, loss, cp = ChessAI.analyze_move(
                    pre_board, played_move, depth)
                brilliant = loss <= 20 and (
                    best_score >= ChessAI.MATE - 1000 or sacrifice)
                result.update(
                    cp=cp, loss=int(loss),
                    best_san=pre_board.san(best_move),
                    tag=self._quality_tag(loss, brilliant))
            else:
                result["cp"] = ChessAI.evaluate_white_cp(post_copy, depth)
            if token == self._analysis_token:
                self._analysis_result = result

        threading.Thread(target=worker, daemon=True).start()
        self.after(90, lambda: self._poll_analysis(token))

    def _poll_analysis(self, token):
        if token != self._analysis_token:
            return
        result = getattr(self, "_analysis_result", None)
        if result is None:
            self.after(90, lambda: self._poll_analysis(token))
            return
        cp = result["cp"]
        self.last_cp = cp
        self._render_eval(ChessAI.win_pct(cp), cp)
        if "tag" in result:
            idx = len(self.san_list) - 1
            if 0 <= idx < len(self.move_tags):
                self.move_tags[idx] = result["tag"]
            self._show_quality(result)
            self._render_history()

    def _show_quality(self, result):
        cn, _mark, color = QUALITY[result["tag"]]
        text = f"上一步评价：{cn}"
        if result["tag"] in ("mistake", "blunder"):
            text += f"（损失约 {result['loss']} 分，引擎首选 {result['best_san']}）"
        elif result["tag"] in ("best", "good", "brilliant"):
            text += f"（与最优解差 {result['loss']} 分）"
        self.lbl_quality.config(text=text, fg=color)

    def _render_eval(self, white_pct, cp=None):
        cv = self.can_eval
        cv.delete("all")
        w = int(cv["width"])
        ww = int(w * white_pct / 100.0)
        cv.create_rectangle(0, 0, ww, 18, fill="#F7F7F0", outline="")
        cv.create_rectangle(ww, 0, w, 18, fill="#2B2B2B", outline="")
        cv.create_rectangle(0, 0, w - 1, 17, outline="#8A8170")
        self.lbl_win_w.config(text=f"白方 {white_pct:.1f}%")
        self.lbl_win_b.config(text=f"黑方 {100 - white_pct:.1f}%")
        if cp is None:
            cp = self.last_cp
        if cp >= ChessAI.MATE_CP - 1000:
            cp_text = "白方形成将杀，胜率接近 100%"
        elif cp <= -ChessAI.MATE_CP + 1000:
            cp_text = "黑方形成将杀，白方胜率接近 0%"
        else:
            adv = "均势" if abs(cp) < 15 else ("白优" if cp > 0 else "黑优")
            cp_text = f"局面分 {cp / 100:+.2f}（{adv}）"
        self.lbl_eval_cp.config(text=cp_text)
        if self.mode == "pve":
            your = white_pct if self.human_color == chess.WHITE else 100 - white_pct
            self.lbl_your_win.config(text=f"你的胜率：{your:.1f}%")
        else:
            self.lbl_your_win.config(text="")

    # ---- 终局判定 ----
    def _check_game_end(self):
        b = self.board
        if not b.is_game_over():
            return False
        self.game_over = True
        self.ai_thinking = False
        if b.is_checkmate():
            winner = not b.turn
            self.result_text = f"将杀！{self._side_name(winner)}获胜"
        elif b.is_stalemate():
            self.result_text = "逼和（和棋）：行棋方未被将军但无合法走法"
        elif b.is_insufficient_material():
            self.result_text = "和棋：双方子力不足以将杀"
        elif b.is_fivefold_repetition():
            self.result_text = "和棋：五次重复局面（自动判和）"
        elif b.is_seventyfive_moves():
            self.result_text = "和棋：七十五回合内无吃子与进兵（自动判和）"
        else:
            self.result_text = "和棋"
        self._update_panel()
        if b.is_checkmate():
            if self.mode == "pve":
                self.sfx.play("win" if winner == self.human_color else "lose")
            else:
                self.sfx.play("win")
        else:
            self.sfx.play("draw")
        messagebox.showinfo("对局结束", self.result_text, parent=self)
        return True

    def _finish_custom(self, text, sound="draw"):
        self.game_over = True
        self.ai_thinking = False
        self._ai_token += 1
        self.result_text = text
        self._update_panel()
        self.sfx.play(sound)
        messagebox.showinfo("对局结束", text, parent=self)

    def _claim_draw(self):
        if self.game_over:
            return
        b = self.board
        if b.can_claim_draw():
            reason = "三次重复局面" if b.can_claim_threefold_repetition() else "五十回合规则"
            self._finish_custom(f"和棋：依据{reason}提和成立")
        elif self.mode == "pvp":
            if messagebox.askyesno("协议和棋", "当前不满足自动提和条件。\n对方是否同意协议和棋？",
                                   parent=self):
                self._finish_custom("和棋：双方协议和棋")
        else:
            messagebox.showinfo("提和", "当前局面不满足三次重复或五十回合提和条件，"
                                "电脑拒绝和棋，请继续对弈。", parent=self)

    def _resign(self):
        if self.game_over:
            return
        side = self.board.turn
        if not messagebox.askyesno("认输", f"确认由当前行棋的{self._side_name(side)}认输？",
                                   parent=self):
            return
        winner = not side
        sound = "draw"
        if self.mode == "pve":
            sound = "win" if winner == self.human_color else "lose"
        else:
            sound = "win"
        self._finish_custom(
            f"{self._side_name(side)}认输，{self._side_name(winner)}获胜", sound)

    # ---- 悔棋 ----
    def _undo(self):
        if self.ai_thinking:
            self._ai_token += 1
            self.ai_thinking = False
        self._analysis_token += 1                 # 使进行中的评估失效
        if not self.board.move_stack:
            return
        self.game_over = False
        self.result_text = ""
        self.lbl_quality.config(text="")
        self._clear_selection()

        def pop_one():
            self.board.pop()
            self.san_list.pop()
            self.move_tags.pop()

        if self.mode == "pve":
            # 撤到“玩家上一次决策点”：pop 之后 board.turn 即被撤那步的行棋方，
            # 一直撤到刚撤掉的是玩家自己的那步为止（通常撤 AI+玩家 两步）
            target = self.human_color
            while self.board.move_stack:
                pop_one()
                if self.board.turn == target:
                    break
        else:
            pop_one()
        self.last_move = self.board.move_stack[-1] if self.board.move_stack else None
        self._redraw()
        self._update_panel()
        self._request_analysis(None, None, human_move=False)
        # 若撤完后轮到 AI（例如玩家执黑时撤掉了 AI 的开局），让 AI 重新走
        self._maybe_ai_turn()

    # ---- 侧栏信息 ----
    def _side_name(self, color):
        if self.mode == "pve":
            return "你" if color == self.human_color else "电脑"
        if self.mode == "pvp" and hasattr(self, "p1_color"):
            pname = "玩家1" if color == self.p1_color else "玩家2"
            return f"{SIDE_CN[color]}·{pname}"
        return SIDE_CN[color] if color is not None else ""

    def _update_panel(self):
        # 状态行
        if self.game_over:
            status = self.result_text
        elif self.ai_thinking:
            status = "电脑思考中…"
        else:
            turn = self.board.turn
            status = f"轮到{self._side_name(turn)}（{SIDE_CN[turn]}）行棋"
            if self.board.is_check():
                status += " —— 将军！"
        self.lbl_status.config(text=status)

        # 吃子与子力差
        remaining = {c: {t: 0 for t in self.VALUE_TYPES()} for c in (chess.WHITE, chess.BLACK)}
        for piece in self.board.piece_map().values():
            remaining[piece.color][piece.piece_type] += 1
        initial = {chess.PAWN: 8, chess.KNIGHT: 2, chess.BISHOP: 2,
                   chess.ROOK: 2, chess.QUEEN: 1}
        cap_lines = []
        mat = {chess.WHITE: 0, chess.BLACK: 0}
        for color in (chess.WHITE, chess.BLACK):
            caps = []
            for pt in (chess.QUEEN, chess.ROOK, chess.BISHOP, chess.KNIGHT, chess.PAWN):
                lost = initial[pt] - remaining[color][pt]
                caps += [GLYPH[(color, pt)]] * lost
                mat[color] += remaining[color][pt] * ChessAI.VALUE[pt]
            cap_lines.append(f"{SIDE_CN[color]}损失: {''.join(caps) if caps else '无'}")
        diff = mat[chess.WHITE] - mat[chess.BLACK]
        if diff > 0:
            cap_lines.append(f"子力: 白方领先 +{diff // 100}")
        elif diff < 0:
            cap_lines.append(f"子力: 黑方领先 +{-diff // 100}")
        else:
            cap_lines.append("子力均等")
        self.lbl_capture.config(text="\n".join(cap_lines))
        self._render_history()

    def _mark_of(self, idx):
        if idx >= len(self.move_tags) or not self.move_tags[idx]:
            return ""
        return QUALITY[self.move_tags[idx]][1]

    def _render_history(self):
        self.txt_hist.config(state="normal")
        self.txt_hist.delete("1.0", "end")
        for i in range(0, len(self.san_list), 2):
            white_san = self.san_list[i] + self._mark_of(i)
            black_san = ""
            if i + 1 < len(self.san_list):
                black_san = self.san_list[i + 1] + self._mark_of(i + 1)
            self.txt_hist.insert("end", f"{i // 2 + 1:>2}. {white_san:<9}{black_san}\n")
        self.txt_hist.see("end")
        self.txt_hist.config(state="disabled")

    @staticmethod
    def VALUE_TYPES():
        return (chess.PAWN, chess.KNIGHT, chess.BISHOP, chess.ROOK, chess.QUEEN, chess.KING)


def main():
    app = ChessApp()
    app.mainloop()


if __name__ == "__main__":
    main()
