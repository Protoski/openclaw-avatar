#!/usr/bin/env python3
"""Avatar 2D para OpenClaw: cara con expresión, respuesta en la panza, voz local con Piper.

Uso:
    python3 avatar_openclaw.py

Escribí en el cuadro de texto y presioná Enter (o "Enviar"). El agente responde
usando `openclaw agent` (mismo mecanismo que audio_assistant.sh), el texto
aparece en la panza y se reproduce en voz con Piper mientras la boca anima.
"""
import json
import queue
import subprocess
import threading
import tkinter as tk

OPENCLAW_BIN = "/home/protoski/.npm-global/bin/openclaw"
AGENT_ID = "main"
SESSION_KEY = "agent:main:avatar-local"
PIPER_BIN = "/home/protoski/.openclaw/audio-env/bin/piper"
PIPER_MODEL = "/home/protoski/.openclaw/audio-models/es_MX-ald-medium.onnx"
SPEECH_WAV = "/tmp/avatar_openclaw_speech.wav"

BG = "#101418"
HEAD = "#e8ecf1"
HEAD_OUTLINE = "#4a5568"
EYE = "#1a2634"
EYE_GLOW = "#3ab6ff"
BELLY_BG = "#0d1b26"
BELLY_TEXT = "#7fe0ff"
MOUTH_COLOR = "#334155"


class Avatar(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Agente OpenClaw")
        self.configure(bg=BG)
        self.geometry("420x640")
        self.resizable(False, False)

        self.canvas = tk.Canvas(self, width=400, height=430, bg=BG, highlightthickness=0)
        self.canvas.pack(pady=10)

        entry_frame = tk.Frame(self, bg=BG)
        entry_frame.pack(fill="x", padx=12, pady=(0, 12))
        self.entry = tk.Entry(
            entry_frame, font=("Sans", 13), bg="#1c232b", fg="white",
            insertbackground="white", relief="flat",
        )
        self.entry.pack(side="left", fill="x", expand=True, ipady=8, padx=(0, 8))
        self.entry.bind("<Return>", lambda e: self.send())
        self.entry.focus_set()
        send_btn = tk.Button(
            entry_frame, text="Enviar", command=self.send,
            bg="#2563eb", fg="white", relief="flat", padx=14,
        )
        send_btn.pack(side="right")

        self.state = "idle"  # idle | thinking | speaking
        self.blink_phase = 0
        self.mouth_phase = 0
        self.belly_text = "Hola, decime algo."
        self.msg_queue = queue.Queue()

        self.draw()
        self.after(120, self.tick)
        self.after(100, self.poll_queue)

    # --- interacción ---

    def send(self):
        text = self.entry.get().strip()
        if not text or self.state != "idle":
            return
        self.entry.delete(0, tk.END)
        self.state = "thinking"
        self.belly_text = "..."
        threading.Thread(target=self.worker, args=(text,), daemon=True).start()

    def worker(self, text):
        reply = self.ask_openclaw(text)
        self.msg_queue.put(("reply", reply))

    def ask_openclaw(self, text):
        try:
            proc = subprocess.run(
                [
                    OPENCLAW_BIN, "agent", "--agent", AGENT_ID,
                    "--session-key", SESSION_KEY,
                    "--message", text, "--thinking", "low", "--json",
                ],
                capture_output=True, text=True, timeout=180,
            )
            data = json.loads(proc.stdout)
            payloads = (data.get("result") or {}).get("payloads") or data.get("payloads") or []
            parts = [p.get("text") for p in payloads if p.get("text")]
            reply = "\n".join(parts).strip()
            return reply or "(sin respuesta de texto)"
        except Exception as e:
            return f"Error: {e}"

    def poll_queue(self):
        try:
            while True:
                kind, payload = self.msg_queue.get_nowait()
                if kind == "reply":
                    self.belly_text = payload
                    self.state = "speaking"
                    threading.Thread(target=self.speak, args=(payload,), daemon=True).start()
                elif kind == "done":
                    self.state = "idle"
        except queue.Empty:
            pass
        self.after(100, self.poll_queue)

    def speak(self, text):
        try:
            clean = text.replace("`", "").replace("*", "").replace("#", "")
            subprocess.run(
                [PIPER_BIN, "-m", PIPER_MODEL, "-f", SPEECH_WAV],
                input=clean, text=True, capture_output=True, timeout=60,
            )
            subprocess.run(["aplay", "-q", SPEECH_WAV], timeout=120)
        except Exception:
            pass
        self.msg_queue.put(("done", None))

    # --- dibujo ---

    def tick(self):
        self.blink_phase = (self.blink_phase + 1) % 40
        self.mouth_phase += 1
        self.draw()
        self.after(120, self.tick)

    def draw(self):
        c = self.canvas
        c.delete("all")
        cx, cy = 200, 140
        r = 90

        c.create_line(cx, cy - r, cx, cy - r - 20, fill=HEAD_OUTLINE, width=3)
        c.create_oval(cx - 6, cy - r - 28, cx + 6, cy - r - 16, fill=EYE_GLOW, outline="")

        c.create_oval(cx - r, cy - r, cx + r, cy + r, fill=HEAD, outline=HEAD_OUTLINE, width=3)

        blink = self.blink_phase in (0, 1) and self.state != "thinking"
        eye_y = cy - 15
        for dx in (-40, 40):
            if blink:
                c.create_line(cx + dx - 14, eye_y, cx + dx + 14, eye_y, fill=EYE, width=4, capstyle="round")
            else:
                c.create_oval(cx + dx - 16, eye_y - 16, cx + dx + 16, eye_y + 16, fill=EYE, outline=EYE_GLOW, width=2)
                c.create_oval(cx + dx - 6, eye_y - 6, cx + dx + 6, eye_y + 6, fill=EYE_GLOW, outline="")

        my = cy + 45
        if self.state == "speaking":
            openness = 6 + 10 * abs((self.mouth_phase % 6) - 3)
            c.create_oval(cx - 22, my - openness / 2, cx + 22, my + openness / 2, fill=MOUTH_COLOR, outline="")
        elif self.state == "thinking":
            for i, dx in enumerate((-20, 0, 20)):
                phase = (self.mouth_phase // 4 + i) % 6
                rr = 4 if phase < 3 else 2
                c.create_oval(cx + dx - rr, my - rr, cx + dx + rr, my + rr, fill=EYE_GLOW, outline="")
        else:
            c.create_arc(cx - 30, my - 15, cx + 30, my + 20, start=200, extent=140, style="arc", outline=MOUTH_COLOR, width=4)

        bx0, by0, bx1, by1 = 30, cy + r + 20, 370, 420
        c.create_rectangle(bx0, by0, bx1, by1, fill=BELLY_BG, outline=HEAD_OUTLINE, width=2)
        c.create_text(
            (bx0 + bx1) / 2, (by0 + by1) / 2, text=self.belly_text, fill=BELLY_TEXT,
            font=("Sans", 11), width=bx1 - bx0 - 20, justify="center",
        )


if __name__ == "__main__":
    Avatar().mainloop()
