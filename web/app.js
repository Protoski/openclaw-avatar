import * as THREE from "/vendor/three.module.js";

const sceneEl = document.getElementById("scene");
const bellyEl = document.getElementById("belly");
const textEl = document.getElementById("text");
const sendEl = document.getElementById("send");

// --- escena base ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0f14);
scene.fog = new THREE.Fog(0x0b0f14, 6, 14);

const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0.3, 6);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
sceneEl.appendChild(renderer.domElement);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- luces (dan el aspecto 3D real: sombras y brillos) ---
scene.add(new THREE.AmbientLight(0x445566, 1.1));
const key = new THREE.PointLight(0xbfe6ff, 22, 20);
key.position.set(3, 3, 4);
scene.add(key);
const rim = new THREE.PointLight(0x3ab6ff, 14, 20);
rim.position.set(-3, -1, -3);
scene.add(rim);

// --- grupo de la cabeza ---
const head = new THREE.Group();
scene.add(head);

const headMat = new THREE.MeshStandardMaterial({ color: 0xe8ecf1, metalness: 0.35, roughness: 0.35 });
const headMesh = new THREE.Mesh(new THREE.SphereGeometry(1.15, 48, 48), headMat);
headMesh.scale.set(1, 0.98, 0.96);
head.add(headMesh);

// antena
const antennaMat = new THREE.MeshStandardMaterial({ color: 0x4a5568, metalness: 0.6, roughness: 0.3 });
const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 12), antennaMat);
antenna.position.set(0, 1.55, 0);
head.add(antenna);
const glowMat = new THREE.MeshStandardMaterial({ color: 0x3ab6ff, emissive: 0x3ab6ff, emissiveIntensity: 2 });
const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 16), glowMat);
antennaTip.position.set(0, 1.8, 0);
head.add(antennaTip);

// ojos (grupo separado para poder "parpadear" escalando en Y)
function makeEye(x) {
  const g = new THREE.Group();
  const socket = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 24), new THREE.MeshStandardMaterial({ color: 0x1a2634 }));
  g.add(socket);
  const iris = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 16), glowMat);
  iris.position.z = 0.16;
  g.add(iris);
  g.position.set(x, 0.15, 0.98);
  return g;
}
const eyeL = makeEye(-0.42);
const eyeR = makeEye(0.42);
head.add(eyeL, eyeR);

// boca (escala en Y para "hablar")
const mouthMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 });
const mouth = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.32, 4, 12), mouthMat);
mouth.rotation.z = Math.PI / 2;
mouth.position.set(0, -0.42, 0.98);
head.add(mouth);

// --- estados y animación ---
let state = "idle"; // idle | thinking | speaking
let t = 0;
let blinkAt = 2 + Math.random() * 3;

function animate() {
  requestAnimationFrame(animate);
  t += 0.016;

  head.rotation.y = Math.sin(t * 0.4) * 0.15;
  head.position.y = Math.sin(t * 0.9) * 0.04;

  if (t > blinkAt && state !== "thinking") {
    const p = (t - blinkAt) * 14;
    const s = p < 1 ? 1 - Math.min(p, 1) : Math.min(p - 1, 1);
    eyeL.scale.y = eyeR.scale.y = Math.max(0.05, s);
    if (p > 2) blinkAt = t + 2 + Math.random() * 3;
  } else {
    eyeL.scale.y = eyeR.scale.y = 1;
  }

  if (state === "speaking") {
    const o = 0.5 + 0.5 * Math.abs(Math.sin(t * 16));
    mouth.scale.y = 0.4 + o * 1.6;
  } else if (state === "thinking") {
    mouth.scale.y = 0.4;
    eyeL.position.y = eyeR.position.y = 0.15 + Math.sin(t * 6) * 0.02;
  } else {
    mouth.scale.y = 1;
  }

  renderer.render(scene, camera);
}
animate();

// --- interacción con el backend local ---
let busy = false;

async function send() {
  const text = textEl.value.trim();
  if (!text || busy) return;
  textEl.value = "";
  busy = true;
  sendEl.disabled = true;
  state = "thinking";
  bellyEl.textContent = "...";

  try {
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    bellyEl.textContent = data.reply || "(sin respuesta)";
    state = "speaking";
    const audio = new Audio(data.audioUrl + "?t=" + Date.now());
    audio.onended = () => { state = "idle"; busy = false; sendEl.disabled = false; };
    audio.onerror = () => { state = "idle"; busy = false; sendEl.disabled = false; };
    audio.play().catch(() => { state = "idle"; busy = false; sendEl.disabled = false; });
  } catch (e) {
    bellyEl.textContent = "Error: " + e.message;
    state = "idle";
    busy = false;
    sendEl.disabled = false;
  }
}

sendEl.addEventListener("click", send);
textEl.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
