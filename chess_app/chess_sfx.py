# -*- coding: utf-8 -*-
"""
走子音效：实时合成 16bit PCM WAV，Windows 下用 winsound 播放，
无需任何外部音频文件；非 Windows 平台自动静默降级。

注意：Python winsound 不允许「内存数据 + 异步播放」组合
（会抛 Cannot play asynchronously from memory），
因此这里用一个后台守护线程同步播放，主线程只负责入队，不阻塞界面。
"""

import io
import math
import queue
import struct
import threading
import wave

SR = 22050

try:
    import winsound
    _HAS_WINSOUND = True
except ImportError:
    winsound = None
    _HAS_WINSOUND = False


def _sine(freq, dur, vol, decay=8.0, harmonic=0.0):
    """指数衰减的正弦音（可叠加一个二次谐波让声音更亮）。"""
    n = int(SR * dur)
    out = []
    for i in range(n):
        t = i / SR
        env = math.exp(-decay * t)
        v = math.sin(2 * math.pi * freq * t)
        if harmonic:
            v += harmonic * math.sin(2 * math.pi * freq * 2 * t)
        out.append(vol * env * v)
    return out


def _noise(dur, vol, decay=40.0):
    n = int(SR * dur)
    step = 214013
    seed = 12345
    out = []
    for i in range(n):
        seed = (seed * step + 2531011) & 0x7FFFFFFF
        rnd = (seed / 0x7FFFFFFF) * 2 - 1
        t = i / SR
        out.append(vol * math.exp(-decay * t) * rnd)
    return out


def _mix(*tracks):
    n = max(len(t) for t in tracks)
    out = [0.0] * n
    for t in tracks:
        for i, v in enumerate(t):
            out[i] += v
    return out


def _concat(*tracks):
    out = []
    for t in tracks:
        out.extend(t)
    return out


def _silence(dur):
    return [0.0] * int(SR * dur)


def _wav_bytes(samples):
    buf = io.BytesIO()
    wf = wave.open(buf, "wb")
    wf.setnchannels(1)
    wf.setsampwidth(2)
    wf.setframerate(SR)
    frames = bytearray()
    for v in samples:
        v = max(-1.0, min(1.0, v))
        frames += struct.pack("<h", int(v * 32767))
    wf.writeframes(bytes(frames))
    wf.close()
    return buf.getvalue()


def _build_sounds():
    s = {}
    # 普通走子：短促木质轻叩（略加长、加大音量，保证可闻）
    s["move"] = _wav_bytes(_mix(
        _sine(680, 0.09, 0.34, decay=12),
        _sine(220, 0.08, 0.20, decay=10),
        _noise(0.016, 0.20, decay=100)))
    # 吃子：更沉的敲击 + 摩擦噪声
    s["capture"] = _wav_bytes(_mix(
        _sine(165, 0.14, 0.46, decay=9),
        _sine(88, 0.11, 0.26, decay=11),
        _noise(0.05, 0.26, decay=42)))
    # 王车易位：两声轻叩
    click = _mix(_sine(680, 0.07, 0.30, decay=14), _noise(0.012, 0.16, decay=100))
    s["castle"] = _wav_bytes(_concat(click, _silence(0.09), click))
    # 选中棋子：轻提示
    s["select"] = _wav_bytes(_sine(1250, 0.045, 0.18, decay=22))
    # 将军：两连高音警示
    s["check"] = _wav_bytes(_concat(
        _sine(880, 0.10, 0.34, decay=9, harmonic=0.25),
        _silence(0.03),
        _sine(1175, 0.13, 0.36, decay=8, harmonic=0.25)))
    # 升变：上行三音
    seq = []
    for j, f in enumerate((659, 880, 1175)):
        seq.append(_sine(f, 0.09, 0.32, decay=7, harmonic=0.3))
        if j < 2:
            seq.append(_silence(0.02))
    s["promote"] = _wav_bytes(_concat(*seq))
    # 获胜：明亮上行琶音
    seq = []
    for j, f in enumerate((523, 659, 784, 1047)):
        seq.append(_sine(f, 0.15, 0.34, decay=5, harmonic=0.2))
        if j < 3:
            seq.append(_silence(0.015))
    s["win"] = _wav_bytes(_concat(*seq))
    # 失利：下行三音
    seq = []
    for j, f in enumerate((440, 349, 262)):
        seq.append(_sine(f, 0.17, 0.32, decay=4.5))
        if j < 2:
            seq.append(_silence(0.02))
    s["lose"] = _wav_bytes(_concat(*seq))
    # 和棋：柔和双音
    s["draw"] = _wav_bytes(_concat(
        _sine(523, 0.13, 0.28, decay=6),
        _silence(0.04),
        _sine(587, 0.17, 0.28, decay=5)))
    return s


class SoundBoard:
    def __init__(self, enabled=True):
        self.enabled = enabled and _HAS_WINSOUND
        self._buf = _build_sounds() if _HAS_WINSOUND else {}
        self._q = queue.Queue()
        if _HAS_WINSOUND:
            threading.Thread(target=self._worker, daemon=True).start()

    def _worker(self):
        while True:
            name = self._q.get()
            if name is None:
                return
            try:                                # 同步播放（工作线程内，不卡界面）
                winsound.PlaySound(self._buf[name], winsound.SND_MEMORY)
            except Exception:
                pass

    def play(self, name):
        if not self.enabled or name not in self._buf:
            return
        # 丢弃尚未播出的旧音效，保证听到的是最新一步
        try:
            while True:
                self._q.get_nowait()
        except queue.Empty:
            pass
        self._q.put(name)

    def demo(self):
        """试听：依次播放 走子/吃子/将军。"""
        if not self.enabled:
            return
        for name in ("move", "capture", "check"):
            self._q.put(name)
