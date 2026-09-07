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
界面: Tkinter + Unicode 棋子字形(无需外部图片), 便于 PyInstaller 单文件打包。
"""

import random
import threading
import tkinter as tk
from tkinter import font as tkfont
from tkinter import messagebox

import chess

# ---------------------------------------------------------------------------
# 界面常量
# ---------------------------------------------------------------------------
SQ = 64                       # 每格像素
BOARD_PX = SQ * 8
COLOR_LIGHT = "#EBECD0"
COLOR_DARK = "#779556"
COLOR_LAST = "#BACA44"
COLOR_SELECT = "#F6F669"
COLOR_DOT = "#262626"
COLOR_PANEL = "#F4F1E8"
FONT_UI = "Microsoft YaHei UI"
FONT_PIECE = "Segoe UI Symbol"

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
    def choose_move(cls, board, difficulty):
        """难度: easy=1层+随机性, medium=2层, hard=3层。返回一个合法走法。"""
        moves = list(board.legal_moves)
        if not moves:
            return None
        if len(moves) == 1:
            return moves[0]
        depth, window = cls.DIFFICULTY.get(difficulty, (2, 0))
        nodes = [0]
        scored = []
        alpha = -cls.MATE * 2
        for move in cls._ordered_moves(board):
            board.push(move)
            sc = -cls._negamax(board, depth - 1, -cls.MATE * 2, -alpha, nodes)
            board.pop()
            scored.append((sc, move))
            if sc > alpha:
                alpha = sc
        best = max(s for s, _ in scored)
        if window:                                     # 简单难度: 近优走法中随机
            candidates = [m for s, m in scored if s >= best - window]
        else:
            candidates = [m for s, m in scored if s == best]
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
        self.last_move = None
        self.game_over = False
        self.result_text = ""
        self.ai_color = chess.BLACK
        self.ai_thinking = False
        self._ai_result = None
        self._ai_token = 0

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

        tk.Button(f, text="开 始 对 弈", font=(FONT_UI, 14, "bold"),
                  bg="#5B8C3E", fg="white", activebackground="#4A7532",
                  activeforeground="white", relief="flat", width=16, pady=8,
                  command=self._start_game).pack(pady=24)
        self._refresh_side_options()

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
        self.geometry("480x560")

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

        hist_frame = tk.Frame(side, bg="#EEE9DC")
        hist_frame.pack(fill="x")
        tk.Label(hist_frame, text="棋谱（代数记谱）", font=(FONT_UI, 9, "bold"),
                 bg="#EEE9DC").pack(anchor="w", padx=4, pady=(4, 0))
        self.txt_hist = tk.Text(hist_frame, width=26, height=13,
                                font=("Consolas", 10), bg="#FFFEF7",
                                relief="flat", wrap="none")
        self.txt_hist.pack(side="left", fill="both", expand=True, padx=(4, 0), pady=4)
        sb = tk.Scrollbar(hist_frame, command=self.txt_hist.yview)
        sb.pack(side="right", fill="y")
        self.txt_hist.config(yscrollcommand=sb.set, state="disabled")

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
        self.geometry("792x586")
        self._maybe_ai_turn()

    def _restart(self):
        # 保留模式/难度; 按当前选边设置重新开局（随机则重新随机）
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
        self.board = chess.Board()
        self.selected = None
        self.legal_targets = {}
        self.san_list = []
        self.last_move = None
        self.game_over = False
        self.result_text = ""
        self.ai_thinking = False
        self._ai_result = None
        self._redraw()
        self._update_panel()

    def _back_to_menu(self):
        self._ai_token += 1
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
        piece_font = tkfont.Font(family=FONT_PIECE, size=34)
        coord_font = tkfont.Font(family="Consolas", size=8, weight="bold")
        for sq in range(64):
            f = chess.square_file(sq)
            r = chess.square_rank(sq)
            cx, cy = self._sq_center(sq)
            x0, y0 = cx - SQ // 2, cy - SQ // 2
            fill = COLOR_LIGHT if (f + r) % 2 == 0 else COLOR_DARK
            if self.last_move and sq in (self.last_move.from_square,
                                         self.last_move.to_square):
                fill = COLOR_LAST
            if sq == self.selected:
                fill = COLOR_SELECT
            cv.create_rectangle(x0, y0, x0 + SQ, y0 + SQ, fill=fill, outline="")
            # 边缘坐标
            tag_color = COLOR_DARK if (f + r) % 2 == 0 else COLOR_LIGHT
            edge_col = 0 if self.bottom_color == chess.WHITE else 7
            edge_row = 7 if self.bottom_color == chess.WHITE else 0
            if f == edge_col:
                cv.create_text(x0 + 7, y0 + 8, text=str(r + 1),
                               font=coord_font, fill=tag_color, anchor="nw")
            if r == edge_row:
                cv.create_text(x0 + SQ - 6, y0 + SQ - 8,
                               text=chr(ord("a") + f),
                               font=coord_font, fill=tag_color, anchor="se")

        # 合法落点提示
        if self.selected is not None:
            for target in self.legal_targets:
                cx, cy = self._sq_center(target)
                if self.board.piece_at(target) is not None or self._is_ep_target(
                        self.selected, target):
                    cv.create_oval(cx - 28, cy - 28, cx + 28, cy + 28,
                                   outline=COLOR_DOT, width=3)
                else:
                    cv.create_oval(cx - 9, cy - 9, cx + 9, cy + 9,
                                   fill=COLOR_DOT, outline="")

        # 棋子
        for sq, piece in self.board.piece_map().items():
            cx, cy = self._sq_center(sq)
            glyph = GLYPH[(piece.color, piece.piece_type)]
            if piece.color == chess.WHITE:                       # 白字黑描边
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    cv.create_text(cx + dx, cy + dy, text=glyph,
                                   fill="#333333", font=piece_font)
                cv.create_text(cx, cy, text=glyph, fill="#FAFAFA", font=piece_font)
            else:
                cv.create_text(cx, cy, text=glyph, fill="#1C1C1C", font=piece_font)

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
        self._redraw()

    def _clear_selection(self):
        self.selected = None
        self.legal_targets = {}
        self._redraw()

    def _is_human_turn(self):
        if self.mode == "pvp":
            return not self.game_over
        return self.board.turn == self.human_color

    def _commit_move(self, move):
        san = self.board.san(move)
        self.board.push(move)
        self.san_list.append(san)
        self.last_move = move
        self._clear_selection()
        self._update_panel()
        if self._check_game_end():
            return
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
            san = self.board.san(move)
            self.board.push(move)
            self.san_list.append(san)
            self.last_move = move
            self._redraw()
            self._update_panel()
            if not self._check_game_end():
                self._update_panel()
        else:                                                    # 兜底, 理论不可达
            self.ai_thinking = False
            self._update_panel()

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
        messagebox.showinfo("对局结束", self.result_text, parent=self)
        return True

    def _finish_custom(self, text):
        self.game_over = True
        self.ai_thinking = False
        self._ai_token += 1
        self.result_text = text
        self._update_panel()
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
        self._finish_custom(f"{self._side_name(side)}认输，{self._side_name(not side)}获胜")

    # ---- 悔棋 ----
    def _undo(self):
        if self.ai_thinking:
            self._ai_token += 1
            self.ai_thinking = False
        if not self.board.move_stack:
            return
        self.game_over = False
        self.result_text = ""
        self._clear_selection()
        if self.mode == "pve":
            # 回退到玩家上一次决策点（撤销 电脑+玩家 两步；残局边界自动处理）
            target = self.human_color
            while self.board.move_stack and self.board.turn != target:
                self.board.pop()
                self.san_list.pop()
        else:
            self.board.pop()
            self.san_list.pop()
        self.last_move = self.board.move_stack[-1] if self.board.move_stack else None
        self._redraw()
        self._update_panel()

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

        # 棋谱
        self.txt_hist.config(state="normal")
        self.txt_hist.delete("1.0", "end")
        for i in range(0, len(self.san_list), 2):
            white_san = self.san_list[i]
            black_san = self.san_list[i + 1] if i + 1 < len(self.san_list) else ""
            self.txt_hist.insert("end", f"{i // 2 + 1:>2}. {white_san:<8}{black_san}\n")
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
