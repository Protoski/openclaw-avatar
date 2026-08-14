#!/usr/bin/env python3
"""Backend local del avatar 3D: sirve web/ y conecta con OpenClaw + Piper.

Uso:
    python3 server.py [puerto]

Abrí http://127.0.0.1:<puerto> en el navegador.
"""
import json
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
WEB_DIR = ROOT / "web"
THREE_BUILD_DIR = ROOT / "web" / "node_modules" / "three" / "build"

OPENCLAW_BIN = "/home/protoski/.npm-global/bin/openclaw"
AGENT_ID = "main"
SESSION_KEY = "agent:main:avatar-local"
PIPER_BIN = "/home/protoski/.openclaw/audio-env/bin/piper"
PIPER_MODEL = "/home/protoski/.openclaw/audio-models/es_MX-ald-medium.onnx"
SPEECH_WAV = ROOT / "web" / "_speech.wav"

MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".wav": "audio/wav",
}


def ask_openclaw(text: str) -> str:
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
        return "\n".join(parts).strip() or "(sin respuesta de texto)"
    except Exception as e:
        return f"Error: {e}"


def speak(text: str) -> None:
    clean = text.replace("`", "").replace("*", "").replace("#", "")
    subprocess.run(
        [PIPER_BIN, "-m", PIPER_MODEL, "-f", str(SPEECH_WAV)],
        input=clean, text=True, capture_output=True, timeout=60,
    )


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass  # silencioso; usar --verbose manual si hace falta debug

    def _send_json(self, obj, status=200):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_file(self, path: Path, content_type: str):
        data = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/":
            path = "/index.html"

        if path.startswith("/vendor/"):
            candidate = (THREE_BUILD_DIR / path[len("/vendor/"):]).resolve()
            if THREE_BUILD_DIR in candidate.parents and candidate.is_file():
                self._send_file(candidate, MIME.get(candidate.suffix, "application/octet-stream"))
            else:
                self.send_response(404)
                self.end_headers()
            return

        if path == "/api/speech.wav":
            if SPEECH_WAV.is_file():
                self._send_file(SPEECH_WAV, MIME[".wav"])
            else:
                self.send_response(404)
                self.end_headers()
            return

        candidate = (WEB_DIR / path.lstrip("/")).resolve()
        if WEB_DIR not in candidate.parents and candidate != WEB_DIR:
            self.send_response(403)
            self.end_headers()
            return
        if candidate.is_file():
            self._send_file(candidate, MIME.get(candidate.suffix, "application/octet-stream"))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if urlparse(self.path).path != "/api/ask":
            self.send_response(404)
            self.end_headers()
            return
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length) or b"{}")
        text = (body.get("text") or "").strip()
        if not text:
            self._send_json({"error": "empty"}, status=400)
            return
        reply = ask_openclaw(text)
        speak(reply)
        self._send_json({"reply": reply, "audioUrl": "/api/speech.wav"})


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"Avatar 3D en http://127.0.0.1:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
