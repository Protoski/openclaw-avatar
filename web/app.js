import * as THREE from "/vendor/three.module.js";

const sceneEl = document.getElementById("scene");
const textEl = document.getElementById("text");
const sendEl = document.getElementById("send");
const micEl = document.getElementById("mic");
const stopEl = document.getElementById("stop");
const statusEl = document.getElementById("status");

// ---------------------------------------------------------------- escena ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0f14);
scene.fog = new THREE.Fog(0x0b0f14, 8, 22);

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0.1, 7.2);
camera.lookAt(0, 0.1, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
sceneEl.appendChild(renderer.domElement);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ----------------------------------------------------------------- luces ---
scene.add(new THREE.AmbientLight(0x445566, 1.0));

const key = new THREE.DirectionalLight(0xcfe9ff, 2.2);
key.position.set(4, 6, 6);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
scene.add(key);

const rim = new THREE.PointLight(0x3ab6ff, 18, 24);
rim.position.set(-4, 1, -3);
scene.add(rim);

const fill = new THREE.PointLight(0xff7a59, 6, 20);
fill.position.set(3, -2, 2);
scene.add(fill);

// piso sutil, para que el cuerpo no flote en la nada
const floor = new THREE.Mesh(
  new THREE.CircleGeometry(6, 48),
  new THREE.MeshStandardMaterial({ color: 0x121a22, roughness: 0.9, metalness: 0.1 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -3.3;
floor.receiveShadow = true;
scene.add(floor);

// --------------------------------------------------------------- material ---
const shell = new THREE.MeshStandardMaterial({ color: 0xe8ecf1, metalness: 0.4, roughness: 0.32 });
const dark = new THREE.MeshStandardMaterial({ color: 0x2a3441, metalness: 0.6, roughness: 0.4 });
const glow = new THREE.MeshStandardMaterial({ color: 0x3ab6ff, emissive: 0x3ab6ff, emissiveIntensity: 2.2 });

// ------------------------------------------------------------------ robot ---
const robot = new THREE.Group();
robot.position.y = -0.2;
scene.add(robot);

// --- torso ---
const body = new THREE.Group();
robot.add(body);

const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.95, 0.9, 8, 32), shell);
torso.position.y = -1.15;
torso.scale.set(1, 1, 0.72);
torso.castShadow = true;
body.add(torso);

// cuello
const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.42, 20), dark);
neck.position.y = -0.16;
body.add(neck);

// hombros
for (const sx of [-1, 1]) {
  const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 24), dark);
  shoulder.position.set(sx * 1.02, -0.86, 0);
  shoulder.castShadow = true;
  body.add(shoulder);
}

// brazos (con leve balanceo idle)
const arms = [];
for (const sx of [-1, 1]) {
  const arm = new THREE.Group();
  arm.position.set(sx * 1.02, -0.86, 0);

  const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.62, 6, 16), shell);
  upper.position.y = -0.48;
  upper.castShadow = true;
  arm.add(upper);

  const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 20), dark);
  elbow.position.y = -0.9;
  arm.add(elbow);

  const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.52, 6, 16), shell);
  fore.position.y = -1.32;
  fore.castShadow = true;
  arm.add(fore);

  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.18, 20, 20), dark);
  hand.position.y = -1.72;
  arm.add(hand);

  arm.userData.side = sx;
  body.add(arm);
  arms.push(arm);
}

// --- pantalla del pecho ("la panza") ---
const screenCanvas = document.createElement("canvas");
screenCanvas.width = 640;
screenCanvas.height = 400;
const sctx = screenCanvas.getContext("2d");
const screenTex = new THREE.CanvasTexture(screenCanvas);
screenTex.colorSpace = THREE.SRGBColorSpace;

const screenMat = new THREE.MeshStandardMaterial({
  map: screenTex, emissive: 0xffffff, emissiveMap: screenTex, emissiveIntensity: 0.85,
  roughness: 0.25, metalness: 0.1,
});
const chestScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.22, 0.78), screenMat);
chestScreen.position.set(0, -1.12, 0.7);
body.add(chestScreen);

const bezel = new THREE.Mesh(new THREE.PlaneGeometry(1.34, 0.9), dark);
bezel.position.set(0, -1.12, 0.688);
body.add(bezel);

let screenText = "Hola, decime algo.";
let screenScroll = 0;

function drawScreen() {
  sctx.fillStyle = "#08131c";
  sctx.fillRect(0, 0, 640, 400);

  // scanlines para look de pantalla
  sctx.fillStyle = "rgba(58,182,255,0.05)";
  for (let y = 0; y < 400; y += 4) sctx.fillRect(0, y, 640, 2);

  sctx.fillStyle = "#7fe0ff";
  sctx.font = "26px sans-serif";
  sctx.textAlign = "center";

  const words = screenText.split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (sctx.measureText(test).width > 580) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);

  const lineH = 34;
  const visible = Math.floor(340 / lineH);
  const maxScroll = Math.max(0, lines.length - visible);
  const start = Math.min(Math.floor(screenScroll), maxScroll);
  const shown = lines.slice(start, start + visible);

  shown.forEach((l, i) => sctx.fillText(l, 320, 60 + i * lineH));

  if (lines.length > visible) {
    sctx.fillStyle = "#3ab6ff";
    sctx.font = "18px sans-serif";
    sctx.fillText(`${start + 1}-${Math.min(start + visible, lines.length)} / ${lines.length}`, 320, 380);
  }

  screenTex.needsUpdate = true;
  return { lines: lines.length, visible };
}

function setScreen(text) {
  screenText = text;
  screenScroll = 0;
  drawScreen();
}

// --- cabeza ---
const head = new THREE.Group();
head.position.y = 0.55;
robot.add(head);

const skull = new THREE.Mesh(new THREE.SphereGeometry(0.86, 48, 48), shell);
skull.scale.set(1, 0.98, 0.94);
skull.castShadow = true;
head.add(skull);

// visor oscuro donde van los ojos
const visor = new THREE.Mesh(new THREE.SphereGeometry(0.865, 48, 48, 0, Math.PI * 2, 0.55, 0.62), dark);
visor.scale.set(1, 0.98, 0.94);
head.add(visor);

// antena
const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.36, 12), dark);
antenna.position.y = 1.0;
head.add(antenna);
const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 16), glow);
antennaTip.position.y = 1.2;
head.add(antennaTip);
const antennaLight = new THREE.PointLight(0x3ab6ff, 3, 4);
antennaLight.position.y = 1.2;
head.add(antennaLight);

// orejas / auriculares
for (const sx of [-1, 1]) {
  const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.14, 20), dark);
  ear.rotation.z = Math.PI / 2;
  ear.position.set(sx * 0.84, 0.02, 0);
  head.add(ear);
}

// ojos
function makeEye(x) {
  const g = new THREE.Group();
  const iris = new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 24), glow);
  g.add(iris);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.025, 12, 28), dark);
  ring.position.z = 0.02;
  g.add(ring);
  g.position.set(x, 0.06, 0.76);
  return g;
}
const eyeL = makeEye(-0.32);
const eyeR = makeEye(0.32);
head.add(eyeL, eyeR);

// boca
const mouth = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.3, 4, 12), dark);
mouth.rotation.z = Math.PI / 2;
mouth.position.set(0, -0.42, 0.74);
head.add(mouth);

// ------------------------------------------------------------- animación ---
let state = "idle"; // idle | listening | thinking | speaking
let t = 0;
let blinkAt = 2 + Math.random() * 3;
const pointer = { x: 0, y: 0 };

window.addEventListener("pointermove", (e) => {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
});

const stateColor = {
  idle: 0x3ab6ff,
  listening: 0x4ade80,
  thinking: 0xfbbf24,
  speaking: 0x3ab6ff,
};

function animate() {
  requestAnimationFrame(animate);
  t += 0.016;

  // respiración
  const breath = Math.sin(t * 1.1) * 0.012;
  body.scale.set(1 + breath, 1 - breath * 0.5, 1 + breath);
  robot.position.y = -0.2 + Math.sin(t * 1.1) * 0.03;

  // la cabeza sigue el puntero (se siente vivo)
  head.rotation.y += (pointer.x * 0.45 - head.rotation.y) * 0.06;
  head.rotation.x += (pointer.y * 0.22 - head.rotation.x) * 0.06;
  body.rotation.y += (pointer.x * 0.12 - body.rotation.y) * 0.04;

  // brazos con balanceo suave
  arms.forEach((arm, i) => {
    const base = arm.userData.side * 0.12;
    arm.rotation.z = base + Math.sin(t * 0.9 + i) * 0.05;
    arm.rotation.x = Math.sin(t * 0.7 + i * 1.7) * 0.06;
  });

  // parpadeo
  if (t > blinkAt && state !== "thinking") {
    const p = (t - blinkAt) * 14;
    const s = p < 1 ? 1 - Math.min(p, 1) : Math.min(p - 1, 1);
    eyeL.scale.y = eyeR.scale.y = Math.max(0.06, s);
    if (p > 2) blinkAt = t + 2 + Math.random() * 4;
  } else {
    eyeL.scale.y += (1 - eyeL.scale.y) * 0.3;
    eyeR.scale.y = eyeL.scale.y;
  }

  // color por estado
  const target = new THREE.Color(stateColor[state]);
  glow.color.lerp(target, 0.08);
  glow.emissive.lerp(target, 0.08);
  antennaLight.color.lerp(target, 0.08);

  if (state === "speaking") {
    mouth.scale.y = 0.5 + Math.abs(Math.sin(t * 15)) * 2.4;
    antennaLight.intensity = 3 + Math.abs(Math.sin(t * 15)) * 3;
  } else if (state === "thinking") {
    mouth.scale.y = 0.5;
    antennaLight.intensity = 2 + Math.abs(Math.sin(t * 4)) * 4;
    head.rotation.z = Math.sin(t * 2) * 0.06;
  } else if (state === "listening") {
    mouth.scale.y = 1.6;
    antennaLight.intensity = 3 + Math.abs(Math.sin(t * 8)) * 4;
  } else {
    mouth.scale.y += (1 - mouth.scale.y) * 0.2;
    antennaLight.intensity = 2.5 + Math.sin(t * 1.5) * 0.6;
    head.rotation.z += (0 - head.rotation.z) * 0.1;
  }

  renderer.render(scene, camera);
}

drawScreen();
animate();

// ----------------------------------------------------------- interacción ---
let busy = false;
let currentAudio = null;

function setState(next) {
  state = next;
  statusEl.textContent = {
    idle: "Listo",
    listening: "Escuchando…",
    thinking: "Pensando…",
    speaking: "Hablando…",
  }[next];
  statusEl.dataset.state = next;
  const active = next !== "idle";
  sendEl.disabled = active;
  micEl.disabled = active;
  stopEl.hidden = next !== "speaking";
}

function finish() {
  busy = false;
  currentAudio = null;
  setState("idle");
}

async function deliver(reply, audioUrl) {
  setScreen(reply);
  setState("speaking");
  currentAudio = new Audio(audioUrl + "?t=" + Date.now());
  currentAudio.onended = finish;
  currentAudio.onerror = finish;
  try {
    await currentAudio.play();
  } catch {
    finish();
  }
}

async function ask(text) {
  if (!text || busy) return;
  busy = true;
  setState("thinking");
  setScreen("…");
  try {
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    await deliver(data.reply || "(sin respuesta)", data.audioUrl);
  } catch (e) {
    setScreen("Error: " + e.message);
    finish();
  }
}

async function listen() {
  if (busy) return;
  busy = true;
  setState("listening");
  setScreen("Te escucho…");
  try {
    const res = await fetch("/api/listen", { method: "POST" });
    const data = await res.json();
    if (!data.text) {
      setScreen("No te escuché bien. Probá de nuevo.");
      finish();
      return;
    }
    textEl.value = data.text;
    busy = false;
    await ask(data.text);
    textEl.value = "";
  } catch (e) {
    setScreen("Error de micrófono: " + e.message);
    finish();
  }
}

function stopSpeaking() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }
  finish();
}

sendEl.addEventListener("click", () => {
  const v = textEl.value.trim();
  textEl.value = "";
  ask(v);
});
micEl.addEventListener("click", listen);
stopEl.addEventListener("click", stopSpeaking);

textEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const v = textEl.value.trim();
    textEl.value = "";
    ask(v);
  }
});

// rueda del mouse sobre la escena = scroll del texto en la pantalla del pecho
sceneEl.addEventListener("wheel", (e) => {
  e.preventDefault();
  screenScroll = Math.max(0, screenScroll + (e.deltaY > 0 ? 1 : -1));
  drawScreen();
}, { passive: false });

// atajos
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && state === "speaking") stopSpeaking();
  if (e.key === "/" && document.activeElement !== textEl) {
    e.preventDefault();
    textEl.focus();
  }
});

setState("idle");
textEl.focus();
