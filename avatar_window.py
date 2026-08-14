#!/usr/bin/env python3
"""Ventana translúcida y sin bordes para el avatar (GTK + WebKit2).

A diferencia de abrirlo en el navegador, acá el fondo es transparente de
verdad: se ve el escritorio detrás del robot, no un rectángulo opaco.

Requiere un compositor activo. En XFCE:
    xfconf-query -c xfwm4 -p /general/use_compositing -s true

Uso:
    python3 avatar_window.py [puerto]
"""
import json
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

import gi

gi.require_version("Gtk", "3.0")
gi.require_version("Gdk", "3.0")
gi.require_version("WebKit2", "4.1")
from gi.repository import Gdk, Gtk, WebKit2  # noqa: E402

ROOT = Path(__file__).resolve().parent
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
URL = f"http://127.0.0.1:{PORT}/?t=1"


def backend_alive() -> bool:
    try:
        urllib.request.urlopen(f"http://127.0.0.1:{PORT}/", timeout=1)
        return True
    except Exception:
        return False


def ensure_backend() -> None:
    if backend_alive():
        return
    subprocess.Popen(
        [sys.executable, str(ROOT / "server.py"), str(PORT)],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True,
    )
    for _ in range(40):
        if backend_alive():
            return
        time.sleep(0.25)
    print(f"Advertencia: el backend no respondió en {PORT}", file=sys.stderr)


class AvatarWindow(Gtk.Window):
    def __init__(self):
        super().__init__(title="Agente OpenClaw")
        self.set_default_size(520, 780)
        self.set_decorated(False)
        self.set_app_paintable(True)
        self.set_keep_above(True)
        self.set_skip_taskbar_hint(False)

        # visual RGBA = transparencia por píxel (necesita compositor)
        screen = self.get_screen()
        visual = screen.get_rgba_visual()
        if visual is not None:
            self.set_visual(visual)
        else:
            print("Sin visual RGBA: no hay compositor activo, la ventana será opaca.", file=sys.stderr)

        manager = WebKit2.UserContentManager()
        manager.register_script_message_handler("app")
        manager.connect("script-message-received::app", self.on_message)

        self.web = WebKit2.WebView.new_with_user_content_manager(manager)
        self.web.set_background_color(Gdk.RGBA(0, 0, 0, 0))

        settings = self.web.get_settings()
        settings.set_enable_developer_extras(True)
        settings.set_media_playback_requires_user_gesture(False)

        self.web.load_uri(URL)
        self.add(self.web)

        self.connect("destroy", Gtk.main_quit)
        self.connect("key-press-event", self.on_key)

    def on_message(self, manager, result):
        try:
            data = json.loads(result.get_js_value().to_string())
        except Exception:
            return
        kind = data.get("type")
        if kind == "drag":
            self.begin_move_drag(
                1, int(data.get("x", 0)), int(data.get("y", 0)), Gtk.get_current_event_time()
            )
        elif kind == "close":
            Gtk.main_quit()
        elif kind == "pin":
            self.set_keep_above(bool(data.get("value", True)))

    def on_key(self, _widget, event):
        ctrl = event.state & Gdk.ModifierType.CONTROL_MASK
        if ctrl and event.keyval in (Gdk.KEY_q, Gdk.KEY_w):
            Gtk.main_quit()
            return True
        return False


def main():
    ensure_backend()
    win = AvatarWindow()
    win.show_all()
    Gtk.main()


if __name__ == "__main__":
    main()
