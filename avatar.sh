#!/usr/bin/env bash
# Abre el avatar. Por defecto usa la ventana translúcida propia (GTK+WebKit).
#
#   ./avatar.sh            ventana translúcida sin bordes (recomendado)
#   ./avatar.sh --browser  ventana de navegador en modo app (fondo opaco)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${AVATAR_PORT:-8765}"
URL="http://127.0.0.1:${PORT}"
MODE="${1:-window}"

# Sesión gráfica: los lanzadores del escritorio a veces no heredan DISPLAY.
if [[ -z "${DISPLAY:-}" ]]; then
  for socket in /tmp/.X11-unix/X*; do
    [[ -S "$socket" ]] || continue
    export DISPLAY=":${socket##*X}"
    break
  done
fi
export XAUTHORITY="${XAUTHORITY:-$HOME/.Xauthority}"
export DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-unix:path=/run/user/$(id -u)/bus}"

if [[ "$MODE" != "--browser" ]]; then
  # La ventana GTK levanta el backend por su cuenta si hace falta.
  exec python3 "$ROOT/avatar_window.py" "$PORT"
fi

# --- modo navegador ---------------------------------------------------------
if ! curl -sf -o /dev/null "$URL"; then
  nohup python3 "$ROOT/server.py" "$PORT" >/tmp/avatar_openclaw_server.log 2>&1 &
  for _ in $(seq 1 40); do
    curl -sf -o /dev/null "$URL" && break
    sleep 0.25
  done
fi

if ! curl -sf -o /dev/null "$URL"; then
  echo "Error: el backend no respondió en $URL" >&2
  tail -20 /tmp/avatar_openclaw_server.log >&2 || true
  exit 1
fi

BROWSER=""
for candidate in /snap/bin/brave brave-browser brave chromium chromium-browser google-chrome; do
  if command -v "$candidate" >/dev/null 2>&1; then
    BROWSER="$candidate"
    break
  fi
done

if [[ -z "$BROWSER" ]]; then
  echo "No encontré un navegador basado en Chromium; abrí $URL a mano." >&2
  exit 1
fi

# Nota: no se usa --user-data-dir. Brave viene como snap y el confinamiento le
# impide escribir en carpetas ocultas del home (~/.cache).
exec "$BROWSER" \
  --app="$URL" \
  --window-size=520,780 \
  --class=OpenClawAvatar \
  >/dev/null 2>&1
