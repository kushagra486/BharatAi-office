"""Score + SFX for the Bharat AI Office brag video, synthesized as one piece.

120 BPM (bar = 2.0s = one scene is exactly two bars), A minor, Am-F-C-G.
Every SFX is pitched into A minor pentatonic and routed through the same
reverb as the music so it sits *in* the track rather than on top of it.
"""
import numpy as np
import wave

SR = 44100
DUR = 20.0
N = int(SR * DUR)
rng = np.random.default_rng(7)


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def env_adsr(n, a, d, s, r, sr=SR):
    a, d, r = int(a * sr), int(d * sr), int(r * sr)
    e = np.full(n, s, dtype=np.float64)
    if a: e[:a] = np.linspace(0, 1, a)
    if d: e[a:a + d] = np.linspace(1, s, min(d, max(0, n - a)))[: len(e[a:a + d])]
    if r and n > r: e[-r:] *= np.linspace(1, 0, r)
    return e


def place(buf, sig, t, gain=1.0):
    i = int(t * SR)
    j = min(len(buf), i + len(sig))
    if i < len(buf): buf[i:j] += sig[: j - i] * gain


def lowpass(x, cutoff):
    # one-pole, vectorized via lfilter-free recursion approximation (small loops ok at this length)
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y


def fft_convolve(x, ir):
    n = len(x) + len(ir) - 1
    nfft = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, nfft) * np.fft.rfft(ir, nfft), nfft)[:len(x)]


# ---------------- buses ----------------
pad = np.zeros(N); pluck = np.zeros(N); bass = np.zeros(N)
drums = np.zeros(N); sfx = np.zeros(N)

CHORDS = {  # voicings near middle C
    'Am': [57, 60, 64], 'F': [53, 57, 60], 'C': [52, 55, 60], 'G': [55, 59, 62],
    'Fmaj7': [53, 57, 60, 64], 'Aadd9': [57, 60, 64, 71],
}
ROOT = {'Am': 45, 'F': 41, 'C': 48, 'G': 43, 'Fmaj7': 41, 'Aadd9': 45}
PROG = ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G', 'Fmaj7', 'Aadd9']  # 10 bars x 2s

# ---------------- pad (detuned saws, softened) ----------------
for b, ch in enumerate(PROG):
    t0 = b * 2.0
    length = 2.0 + (0.6 if b < 9 else 0.0)
    n = int(length * SR)
    tt = np.arange(n) / SR
    sig = np.zeros(n)
    for m in CHORDS[ch]:
        f = midi(m)
        for det in (-0.12, 0.0, 0.11):
            ff = f * 2 ** (det / 12)
            ph = rng.random()
            saw = 2 * ((tt * ff + ph) % 1.0) - 1
            sig += saw
    sig /= (3 * len(CHORDS[ch]))
    rel = 0.6 if b < 9 else 1.9
    sig *= env_adsr(n, 0.35, 0.3, 0.8, rel)
    place(pad, sig, t0)
pad = lowpass(pad, 1500)
pad *= np.clip(np.arange(N) / (SR * 1.2), 0, 1)  # fade in over the hook

# ---------------- pluck arpeggio (8ths) ----------------
def pluck_note(m, dur=0.45, bright=1.0):
    n = int(dur * SR); tt = np.arange(n) / SR; f = midi(m)
    tri = 2 * np.abs(2 * ((tt * f) % 1.0) - 1) - 1
    sine2 = np.sin(2 * np.pi * 2 * f * tt) * 0.25 * bright
    return (tri + sine2) * np.exp(-tt * 7.5)

for b, ch in enumerate(PROG[:9]):
    notes = CHORDS[ch][:3]
    pattern = [notes[0] + 12, notes[1] + 12, notes[2] + 12, notes[1] + 12, notes[0] + 24, notes[2] + 12, notes[1] + 12, notes[2] + 12]
    for k, m in enumerate(pattern):
        t = b * 2.0 + k * 0.25
        vel = 0.55 if k % 2 == 0 else 0.4
        if b < 2: vel *= 0.7  # quieter in the hook
        place(pluck, pluck_note(m), t, vel)

# ---------------- bass (8th pulse, from the drop) ----------------
for b, ch in enumerate(PROG):
    if b < 2 or b > 8: continue
    for k in range(8):
        t = b * 2.0 + k * 0.25
        n = int(0.22 * SR); tt = np.arange(n) / SR; f = midi(ROOT[ch] - 12)
        s = np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * 2 * f * tt)
        place(bass, s * env_adsr(n, 0.004, 0.08, 0.6, 0.06), t, 0.55 if k % 2 == 0 else 0.4)

# ---------------- drums ----------------
def kick():
    n = int(0.35 * SR); tt = np.arange(n) / SR
    f = 45 + 110 * np.exp(-tt * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-tt * 9)

def hat():
    n = int(0.06 * SR); tt = np.arange(n) / SR
    w = rng.standard_normal(n); w = w - np.concatenate([[0], w[:-1]])  # crude highpass
    return w * np.exp(-tt * 70) * 0.35

def clap():
    n = int(0.22 * SR); tt = np.arange(n) / SR
    w = rng.standard_normal(n)
    w = lowpass(w, 2500) - lowpass(w, 900)
    e = np.exp(-tt * 18) * (1 + 0.6 * np.exp(-((tt - 0.012) ** 2) / 2e-5))
    return w * e * 1.6

kick_times = [t for t in np.arange(4.0, 18.0, 0.5)]
for t in kick_times: place(drums, kick(), t, 0.9)
for t in np.arange(8.25, 18.0, 0.5): place(drums, hat(), t, 0.5)
for t in np.arange(8.5, 16.0, 1.0): place(drums, clap(), t, 0.28)

# sidechain-ish pump on pad + bass from the drop
duck = np.ones(N)
for t in kick_times:
    i = int(t * SR); n = int(0.28 * SR)
    j = min(N, i + n)
    duck[i:j] = np.minimum(duck[i:j], 1 - 0.45 * np.exp(-np.arange(j - i) / SR * 11))
pad *= duck; bass *= 0.7 + 0.3 * duck

# ---------------- SFX (all in A minor pentatonic) ----------------
PENTA = [69, 72, 74, 76, 79, 81, 84, 86, 88, 91, 93]  # A4 C5 D5 E5 G5 A5 C6 ...

def bell(m, dur=0.9):
    n = int(dur * SR); tt = np.arange(n) / SR; f = midi(m)
    s = np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(2 * np.pi * 2.76 * f * tt) * np.exp(-tt * 6)
    return s * np.exp(-tt * 4.5) * env_adsr(n, 0.003, 0, 1, 0.05)

def tick():
    n = int(0.018 * SR); tt = np.arange(n) / SR
    w = rng.standard_normal(n)
    return (w - np.concatenate([[0], w[:-1]])) * np.exp(-tt * 260) * 0.5

def whoosh(t_end, length=0.55):
    n = int(length * SR); tt = np.arange(n) / SR
    w = lowpass(rng.standard_normal(n), 1800)
    e = (tt / length) ** 2.2 * np.exp(-((tt - length) ** 2) / 0.002)
    e = np.sin(np.pi * tt / length * 0.92) ** 3
    place(sfx, w * e * 0.9, t_end - length * 0.8)

# typing: one soft tick per character pair (1.25s -> 2.85s)
for k, t in enumerate(np.linspace(1.25, 2.85, 22)):
    place(sfx, tick(), t + rng.uniform(-0.008, 0.008), rng.uniform(0.22, 0.34))
# send press -> "Sending…"
place(sfx, bell(76, 0.6), 3.2, 0.28); place(sfx, bell(81, 0.9), 3.3, 0.3)
# scene whooshes
for b in (4.0, 8.0, 12.0, 16.0): whoosh(b)
# 11 cards pop in, walking up the pentatonic
for i in range(11): place(sfx, pluck_note(PENTA[i] - 12, 0.4, 0.6), 4.45 + i * 0.1, 0.22)
# status flips: tiny bells
for i in range(11):
    flip = 5.85 if i == 0 else 6.0 + (i - 1) * 0.1
    place(sfx, bell(PENTA[(i * 2) % 6 + 5], 0.35), flip, 0.07)
# ring on Simran
place(sfx, bell(88, 1.2), 9.7, 0.14)
# cursor click + diff lines
place(sfx, tick(), 13.45, 0.6); place(sfx, bell(81, 0.5), 13.47, 0.12)
for i in range(5): place(sfx, bell(PENTA[i + 3], 0.35), 13.8 + i * 0.2, 0.06)
# outro: three dots, then the logo chord
for i, m in enumerate((81, 84, 88)): place(sfx, bell(m, 0.8), 16.1 + i * 0.09, 0.12)
for m in (69, 72, 76, 83): place(sfx, bell(m, 3.2), 16.3, 0.07)

# ---------------- mix ----------------
music = pad * 0.55 + pluck * 0.16 + bass * 0.42
ir_len = int(1.9 * SR)
tt = np.arange(ir_len) / SR
irL = rng.standard_normal(ir_len) * np.exp(-tt / 0.45); irL /= np.sqrt(np.sum(irL ** 2))
irR = rng.standard_normal(ir_len) * np.exp(-tt / 0.45); irR /= np.sqrt(np.sum(irR ** 2))
wet_src = music * 0.9 + sfx * 1.0
L = music + sfx * 0.8 + drums * 0.62 + fft_convolve(wet_src, irL) * 0.28
R = music + sfx * 0.8 + drums * 0.62 + fft_convolve(wet_src, irR) * 0.28

# slight stereo width on plucks
L += np.roll(pluck, int(0.007 * SR)) * 0.05; R += pluck * 0.05

st = np.stack([L, R], axis=1)
st -= st.mean(axis=0)
st /= np.max(np.abs(st)) + 1e-9
st = np.tanh(st * 1.4) / np.tanh(1.4)       # gentle glue
fade = np.ones(N); fn = int(0.8 * SR); fade[-fn:] = np.linspace(1, 0, fn) ** 1.5
st *= fade[:, None]
st *= 10 ** (-1.2 / 20) / (np.max(np.abs(st)) + 1e-9)

pcm = (st * 32767).astype(np.int16)
with wave.open('music.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('wrote music.wav', pcm.shape)
