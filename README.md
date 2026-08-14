# openclaw-avatar

Avatar 2D local para OpenClaw: cara animada (ojos que parpadean, boca con
estados idle/pensando/hablando), respuesta en texto sobre la "panza", y voz
con Piper (TTS local). Se conecta al agente real vía `openclaw agent --json`.

## Requisitos
- Python 3 con `tkinter` (`sudo apt install python3-tk`)
- OpenClaw instalado y accesible en el PATH (`openclaw`)
- Piper instalado en un entorno local (ver rutas en `avatar_openclaw.py`)

## Uso
```bash
python3 avatar_openclaw.py
```

Escribí un mensaje y presioná Enter. El agente responde, se muestra en la
panza y se reproduce en voz mientras la boca anima.
