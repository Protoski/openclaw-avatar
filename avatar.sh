#!/usr/bin/env bash
# Levanta el backend y abre el avatar en una ventana propia (sin barra del navegador).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${AVATAR_PORT:-8765}"
URL="http://127.0.0.1:${PORT}"

# Sesión gráfica: los lanzadores del escritorio a veces no heredan DISPLAY.
if [[ -z "${DISPLAY:-}" ]]; then
  for socket in /tmp/.X11-unix/X*; do
    [[ -S "$socket" ]] || continue
    export DISPLAY=":${socket##*X}"
    break
  done
fi
export XAUTHORITY="${XAUTHORITY:-$HOME/.Xauthority}"

# Backend: reusar si ya está escuchando, si no arrancarlo.
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

# Ventana propia: --app quita barra de direcciones, pestañas y menús.
# Se usa un perfil aparte para no tocar tu Brave de todos los días.
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
# impide escribir en carpetas ocultas del home (~/.cache), así que la ventana
# usa el perfil normal. --app igual quita barra de direcciones, pestañas y menús.
exec "$BROWSER" \
  --app="$URL" \
  --window-size=520,780 \
  --class=OpenClawAvatar \
  >/dev/null 2>&1
