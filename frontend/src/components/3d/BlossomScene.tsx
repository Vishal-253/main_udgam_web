import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Billboard, Environment, Lightformer, useTexture, Html, PerformanceMonitor, useProgress } from "@react-three/drei";
import tree1 from "@/assets/tree1.webp";
import tree2 from "@/assets/tree2.webp";
import tree3 from "@/assets/tree3.webp";
import groundImg from "@/assets/ground.jpg";
import roadImg from "@/assets/forest-road.jpg";
import dragonImg from "@/assets/sky-dragon-real.webp";
import woodImg from "@/assets/wood_planks.webp";
import canvasImg from "@/assets/canvas_fabric.webp";
import clothesImg from "@/assets/folded_clothes.webp";
import dominosImg from "@/assets/dominos_pizza_photo.webp";
import quarksImg from "@/assets/quarks_tech_photo.webp";
import arcadeScreenImg from "@/assets/arcade_screen_udgam.webp";
import mountainImg from "@/assets/distant_mountains_sikkim.webp";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

/* ─── deterministic RNG ─────────────────────────────── */
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

/* ─── Road centre-line: x as a function of z ───────── */
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
};
// Straight at the start (z≥8) and at the campus (z≤-95), winding in between.
const roadEnvelope = (z: number) => smooth(8, -8, z) * smooth(-95, -80, z);
export function roadX(z: number) {
  return (3.6 * Math.sin(z * 0.08) + 1.3 * Math.sin(z * 0.19 + 1.0)) * roadEnvelope(z);
}
function roadSlope(z: number) {
  const h = 0.05;
  return (roadX(z + h) - roadX(z - h)) / (2 * h);
}
const ROAD_HALF_W = 1.575;

type TreeSpec = { pos: THREE.Vector3; scale: number; texIdx: number };

/* ─── Forest: ONE pair of trees per ~6 units of road ── */
/* low = phones / weak devices: alpha-tested cut-outs instead of blended transparency (far less
   overdraw), and fewer background trees */
function Forest({ low = false }: { low?: boolean }) {
  const texs = useTexture([tree1, tree2, tree3]);
  texs.forEach((t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 16;
  });

  const trees = useMemo<TreeSpec[]>(() => {
    const r = rng(77);
    const list: TreeSpec[] = [];
    // Road z: 10 → -75. One pair every ~6 units = ~14 pairs visible
    for (let i = 0; i < 14; i++) {
      const z = 7 - i * 6.0 + (r() - 0.5) * 1.2;
      const texIdx = i % 3;
      // Left side
      list.push({
        pos: new THREE.Vector3(roadX(z) - (6.5 + r() * 3.5), 0, z),
        scale: 0.9 + r() * 0.5,
        texIdx,
      });
      // Right side (different variety)
      const zr = z + (r() - 0.5) * 1.5;
      list.push({
        pos: new THREE.Vector3(roadX(zr) + 6.5 + r() * 3.5, 0, zr),
        scale: 0.9 + r() * 0.5,
        texIdx: (texIdx + 1) % 3,
      });
    }
    return list;
  }, []);

  return (
    <group>
      {trees.map((t, i) => {
        const texture = texs[t.texIdx];
        if (!texture) return null;
        const h = 10 * t.scale;
        const w = h * 0.94;
        return (
          <Billboard key={i} position={[t.pos.x, h * 0.5 - 1.5, t.pos.z]} lockX lockZ>
            <mesh>
              <planeGeometry args={[w, h]} />
              <meshStandardMaterial
                map={texture}
                alphaTest={low ? 0.5 : 0.07}
                transparent={!low}
                side={THREE.DoubleSide}
                roughness={0.88}
                metalness={0.0}
                depthWrite={true}
              />
            </mesh>
          </Billboard>
        );
      })}
    </group>
  );
}

/* ─── Background treeline for depth ─────────────────── */
function BackgroundTrees({ low = false }: { low?: boolean }) {
  const texs = useTexture([tree1, tree2, tree3]);
  texs.forEach((t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; });

  const trees = useMemo<TreeSpec[]>(() => {
    const r = rng(55);
    const list: TreeSpec[] = [];
    for (let i = 0; i < 24; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const z = 5 - i * 3.8 - r() * 1.5;
      list.push({
        pos: new THREE.Vector3(roadX(z) * 0.6 + side * (11 + r() * 13), 0, z),
        scale: 0.6 + r() * 0.32,
        texIdx: i % 3,
      });
    }
    return low ? list.filter((_, idx) => idx % 2 === 0) : list;
  }, [low]);

  return (
    <group>
      {trees.map((t, i) => {
        const tex = texs[t.texIdx];
        if (!tex) return null;
        const h = 9 * t.scale;
        return (
          <Billboard key={i} position={[t.pos.x, h * 0.5 - 1.2, t.pos.z]} lockX lockZ>
            <mesh>
              <planeGeometry args={[h * 0.9, h]} />
              <meshStandardMaterial
                map={tex}
                alphaTest={low ? 0.5 : 0.1}
                transparent={!low}
                side={THREE.DoubleSide}
                roughness={0.95}
                depthWrite={true}
              />
            </mesh>
          </Billboard>
        );
      })}
    </group>
  );
}

/* ─── Ground (improved grass + road with edge lines) ── */
function Ground() {
  const [grass, road] = useTexture([groundImg, roadImg]);
  const roadGeo = useMemo(() => {
    const zStart = 30, zEnd = -110, step = 0.5, tile = 6.36;
    const n = Math.round((zStart - zEnd) / step);
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    let dist = 0, prevX = roadX(zStart), prevZ = zStart;
    for (let i = 0; i <= n; i++) {
      const z = zStart - i * step;
      const x = roadX(z);
      dist += Math.hypot(x - prevX, z - prevZ);
      prevX = x; prevZ = z;
      const sl = roadSlope(z);
      // unit normal to the tangent (sl, -1) in the XZ plane
      const len = Math.hypot(sl, 1);
      const nx = 1 / len, nz = sl / len;
      pos.push(x - nx * ROAD_HALF_W, 0, z - nz * ROAD_HALF_W, x + nx * ROAD_HALF_W, 0, z + nz * ROAD_HALF_W);
      uv.push(0, dist / tile, 1, dist / tile);
      if (i < n) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, []);
  if (!grass || !road) return null;
  grass.wrapS = grass.wrapT = THREE.RepeatWrapping;
  grass.repeat.set(9, 18);
  grass.colorSpace = THREE.SRGBColorSpace;
  grass.anisotropy = 8;
  road.wrapS = road.wrapT = THREE.RepeatWrapping;
  road.repeat.set(1, 1);
  road.colorSpace = THREE.SRGBColorSpace;
  road.anisotropy = 8;
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, -40]} receiveShadow>
        <planeGeometry args={[80, 140]} />
        <meshStandardMaterial map={grass} roughness={0.96} />
      </mesh>
      <mesh geometry={roadGeo} position={[0, 0.025, 0]} receiveShadow>
        <meshStandardMaterial map={road} roughness={0.93} />
      </mesh>
    </>
  );
}

/* ─── Petal particles ────────────────────────────────── */
const petalVert = /* glsl */ `
  uniform float uTime; uniform float uSpeed;
  attribute float aSeed;
  varying float vSeed;
  void main() {
    vec3 p = position;
    float t = uTime * uSpeed + aSeed * 40.0;
    p.y = mod(p.y - t * (0.7 + aSeed * 0.8), 14.0);
    p.x += sin(t * 0.9 + aSeed * 18.0) * (1.2 + aSeed * 1.6) + t * 0.15;
    p.x = mod(p.x + 22.0, 44.0) - 22.0;
    p.z += cos(t * 0.65 + aSeed * 11.0) * (0.8 + aSeed);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp((20.0 + aSeed * 22.0) * (10.0 / -mv.z), 2.0, 44.0);
    vSeed = aSeed;
  }`;
const petalFrag = /* glsl */ `
  varying float vSeed;
  uniform float uAlpha;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float a = vSeed * 6.28;
    uv = mat2(cos(a), -sin(a), sin(a), cos(a)) * uv;
    float d = length(vec2(uv.x * 1.8, uv.y + abs(uv.x) * 0.6));
    if (d > 0.42) discard;
    float vein = smoothstep(0.03, 0.0, abs(uv.x)) * 0.14;
    vec3 c = mix(vec3(0.96, 0.50, 0.68), vec3(1.0, 0.91, 0.94), vSeed) + vein;
    gl_FragColor = vec4(c, smoothstep(0.42, 0.18, d) * 0.90 * uAlpha);
  }`;

function Petals({ count, progress }: { count: number; progress: React.MutableRefObject<number> }) {
  const geo = useMemo(() => {
    const r = rng(99);
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (r() - 0.5) * 44;
      pos[i * 3 + 1] = r() * 14;
      pos[i * 3 + 2] = 12 - r() * 100;
      seed[i] = r();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    return g;
  }, [count]);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uSpeed: { value: 1 }, uAlpha: { value: 1 } }), []);
  useFrame((_, d) => {
    uniforms.uTime.value += Math.min(d, 0.05);
    uniforms.uSpeed.value = 1 + progress.current * 0.9;
    const aerialT = Math.max(0, (progress.current - 0.85) / 0.15);
    uniforms.uAlpha.value = 1.0 - aerialT;
  });
  return (
    <points geometry={geo}>
      <shaderMaterial vertexShader={petalVert} fragmentShader={petalFrag} uniforms={uniforms} transparent depthWrite={false} />
    </points>
  );
}

/* ─── Wooden sign ────────────────────────────────────── */
function makeSignTexture(label: string, accent: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 420;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);
  const grain = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grain.addColorStop(0, "#5d351f");
  grain.addColorStop(0.5, "#392014");
  grain.addColorStop(1, "#25140d");
  ctx.fillStyle = grain;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = 24; y < canvas.height; y += 35) {
    ctx.strokeStyle = y % 70 === 0 ? "rgba(255,210,150,.11)" : "rgba(0,0,0,.13)";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(220, y - 10, 720, y + 12, 1024, y - 3);
    ctx.stroke();
  }
  ctx.strokeStyle = accent;
  ctx.lineWidth = 14;
  ctx.strokeRect(28, 28, canvas.width - 56, canvas.height - 56);
  ctx.fillStyle = "#fff8e8";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 126px Georgia, serif";
  ctx.shadowColor = "rgba(0,0,0,.72)";
  ctx.shadowBlur = 14;
  ctx.fillText(label, canvas.width / 2, canvas.height / 2 + 7);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function ForestSign({ label, position, rotation = 0, accent }: { label: string; position: [number, number, number]; rotation?: number; accent: string }) {
  const texture = useMemo(() => makeSignTexture(label, accent), [label, accent]);
  const z = position[2];
  return (
    <group position={[position[0] + roadX(z), position[1], z]} rotation-y={rotation + Math.atan(roadSlope(z))}>
      <mesh position={[-1.55, 1.35, 0]} castShadow>
        <cylinderGeometry args={[0.11, 0.15, 2.7, 12]} />
        <meshStandardMaterial color="#3d2418" roughness={0.95} />
      </mesh>
      <mesh position={[1.55, 1.35, 0]} castShadow>
        <cylinderGeometry args={[0.11, 0.15, 2.7, 12]} />
        <meshStandardMaterial color="#3d2418" roughness={0.95} />
      </mesh>
      <mesh position={[0, 2.4, 0]} castShadow>
        <boxGeometry args={[3.75, 1.5, 0.18]} />
        <meshStandardMaterial color="#3a2115" roughness={0.86} />
      </mesh>
      <mesh position={[0, 2.4, 0.101]}>
        <planeGeometry args={[3.55, 1.3]} />
        <meshStandardMaterial map={texture} roughness={0.78} />
      </mesh>
      <mesh position={[-1.55, 0.12, 0]} castShadow>
        <cylinderGeometry args={[0.24, 0.34, 0.25, 12]} />
        <meshStandardMaterial color="#60594e" roughness={1} />
      </mesh>
      <mesh position={[1.55, 0.12, 0]} castShadow>
        <cylinderGeometry args={[0.24, 0.34, 0.25, 12]} />
        <meshStandardMaterial color="#60594e" roughness={1} />
      </mesh>
    </group>
  );
}

/* ─── Camera: road travel + aerial lift at end ───────── */
function CameraRig({ progress }: { progress: React.MutableRefObject<number> }) {
  const { camera, scene } = useThree();
  const sun = useRef<THREE.DirectionalLight>(null);
  const cur = useRef(0);
  const morning = useMemo(() => new THREE.Color("#dbe7fb"), []);
  const golden = useMemo(() => new THREE.Color("#ecdcf5"), []);
  const aerialSky = useMemo(() => new THREE.Color("#cbe0f8"), []);

  useFrame((state, d) => {
    const dt = Math.min(d, 0.05);
    cur.current += (progress.current - cur.current) * (1 - Math.exp(-4 * dt));
    const p = cur.current;
    const t = state.clock.elapsedTime;

    // Steady eye-level road travel (no upward aerial lift at end)
    const roadZ = 10 - p * 86;
    const camY = 1.75 + Math.sin(t * 0.5) * 0.03;
    const camZ = roadZ;
    const lookZ = camZ - 14;

    camera.position.set(
      roadX(camZ) + state.pointer.x * 0.35,
      camY,
      camZ,
    );
    camera.lookAt(
      roadX(lookZ),
      1.9 + state.pointer.y * 0.25,
      lookZ,
    );

    const col = morning.clone().lerp(golden, Math.min(p * 1.2, 1));
    if (scene.fog) {
      const fog = scene.fog as THREE.Fog;
      fog.color.copy(col);
      fog.near = 15;
      fog.far = 140;
    }
    (scene.background as THREE.Color)?.copy?.(col);

    if (sun.current) {
      sun.current.color.set("#fff4e6").lerp(new THREE.Color("#ffb37a"), Math.min(p, 1));
      sun.current.position.set(10, 14, camera.position.z + 6);
      sun.current.target.position.set(0, 0, camera.position.z - 10);
      sun.current.target.updateMatrixWorld();
    }
  });

  return (
    <directionalLight
      ref={sun}
      intensity={2.4}
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-30}
      shadow-camera-right={30}
      shadow-camera-top={30}
      shadow-camera-bottom={-30}
    />
  );
}

/* ─── 3D Festival Hot Air Balloon ("UDGAM") ───────────────── */
function HotAirBalloon({ progress }: { progress: React.MutableRefObject<number> }) {
  const balloonRef = useRef<THREE.Group>(null);
  const burnerLightRef = useRef<THREE.PointLight>(null);

  // Inverted aerodynamic teardrop balloon envelope geometry
  const balloonGeo = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 36; i++) {
      const t = i / 36;
      const y = (t - 0.45) * 7.2;
      let r = 0;
      if (t > 0.4) {
        const st = (t - 0.4) / 0.6;
        r = 3.2 * Math.sin(st * Math.PI * 0.5 + 0.35);
      } else {
        const lt = t / 0.4;
        r = 0.95 + 2.25 * Math.pow(lt, 0.9);
      }
      pts.push(new THREE.Vector2(Math.max(0.1, r), y));
    }
    const geo = new THREE.LatheGeometry(pts, 36);
    geo.computeVertexNormals();
    return geo;
  }, []);

  // Festival Sakura canopy pattern with bold "UDGAM" printed on both sides
  const balloonTex = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Alternating festival vertical gores (cherry blossom pink & ivory)
      const stripes = 16;
      const w = canvas.width / stripes;
      for (let i = 0; i < stripes; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#ff7597' : '#fff5f8';
        ctx.fillRect(i * w, 0, w, canvas.height);
        // Golden accent pinstripe along each seam
        ctx.fillStyle = '#f5c842';
        ctx.fillRect(i * w + w - 3, 0, 3, canvas.height);
      }

      // Middle white festival ribbon banner
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.fillRect(0, 192, canvas.width, 128);

      // Ribbon gold borders
      ctx.fillStyle = '#f5c842';
      ctx.fillRect(0, 186, canvas.width, 6);
      ctx.fillRect(0, 320, canvas.width, 6);

      // Ruby pink accent lines
      ctx.fillStyle = '#e11d48';
      ctx.fillRect(0, 180, canvas.width, 6);
      ctx.fillRect(0, 326, canvas.width, 6);

      // "UDGAM" bold festive typography with blossoms
      ctx.fillStyle = '#d81b4b';
      ctx.font = '900 84px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(216, 27, 75, 0.45)';
      ctx.shadowBlur = 10;

      // Front Face
      ctx.fillText('🌸 UDGAM 🌸', canvas.width * 0.25, 256);
      // Back Face
      ctx.fillText('🌸 UDGAM 🌸', canvas.width * 0.75, 256);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 16;
    return tex;
  }, []);

  useFrame((state, delta) => {
    if (!balloonRef.current) return;
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime * 0.5;

    // Follows the journey down the valley with serene, graceful floating
    const journeyZ = 6 - progress.current * 72;
    const targetX = roadX(journeyZ) + Math.sin(t * 0.4) * 5.0 + 3.8;
    const targetY = 15.5 + Math.sin(t * 0.8) * 1.4;
    const targetZ = journeyZ - 18 + Math.cos(t * 0.3) * 4.0;

    balloonRef.current.position.lerp(new THREE.Vector3(targetX, targetY, targetZ), 1.5 * dt);

    // Gentle slow rotation showing both sides of UDGAM
    balloonRef.current.rotation.y = t * 0.25;
    // Gentle sway in the mountain breeze
    balloonRef.current.rotation.z = Math.sin(t * 0.6) * 0.04;
    balloonRef.current.rotation.x = Math.cos(t * 0.5) * 0.03;

    // Burner light flicker
    if (burnerLightRef.current) {
      burnerLightRef.current.intensity = 2.2 + Math.sin(state.clock.elapsedTime * 8.0) * 0.7;
    }
  });

  return (
    <group ref={balloonRef} position={[3.8, 15.5, -20]}>
      {/* ── Main Teardrop Balloon Envelope ── */}
      <mesh geometry={balloonGeo} castShadow receiveShadow>
        <meshStandardMaterial
          map={balloonTex}
          roughness={0.4}
          metalness={0.08}
        />
      </mesh>

      {/* Balloon Top Crown Cap (Golden finial) */}
      <mesh position={[0, 4.05, 0]}>
        <sphereGeometry args={[0.35, 12, 10]} />
        <meshStandardMaterial color="#f5c842" emissive="#d4a017" emissiveIntensity={0.5} metalness={0.7} />
      </mesh>

      {/* ── Wicker Basket Gondola ── */}
      <group position={[0, -5.2, 0]}>
        {/* Wicker Rattan Basket Body */}
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.9, 0.75, 1.1, 16]} />
          <meshStandardMaterial color="#8a5a36" roughness={0.9} />
        </mesh>
        {/* Basket Padded Rim */}
        <mesh position={[0, 0.55, 0]}>
          <torusGeometry args={[0.9, 0.08, 8, 24]} rotation-x={Math.PI / 2} />
          <meshStandardMaterial color="#5a3418" roughness={0.8} />
        </mesh>
        {/* Festive Mini Sakura Bunting around basket */}
        <mesh position={[0, 0.1, 0]}>
          <cylinderGeometry args={[0.92, 0.85, 0.2, 16, 1, true]} />
          <meshStandardMaterial color="#ff80ab" roughness={0.5} />
        </mesh>
      </group>

      {/* ── 4 Suspension Rigging Ropes ── */}
      {[
        [-0.6, -0.6],
        [0.6, -0.6],
        [-0.6, 0.6],
        [0.6, 0.6],
      ].map(([rx, rz], i) => (
        <mesh key={i} position={[rx * 0.85, -3.8, rz * 0.85]}>
          <cylinderGeometry args={[0.02, 0.02, 2.5, 6]} />
          <meshStandardMaterial color="#3a2518" metalness={0.2} roughness={0.8} />
        </mesh>
      ))}

      {/* ── Propane Burner Frame & Flame Glow ── */}
      <group position={[0, -3.1, 0]}>
        <mesh>
          <cylinderGeometry args={[0.3, 0.3, 0.35, 12]} />
          <meshStandardMaterial color="#2d323b" metalness={0.85} roughness={0.3} />
        </mesh>
        {/* Pulsating Burner Fire Flame */}
        <pointLight ref={burnerLightRef} color="#ff9933" intensity={2.4} distance={9} decay={2} />
      </group>
    </group>
  );
}



/* ─── Merch Stall ────────────────────────────────────── */
function MerchStall({ position }: { position: [number, number, number] }) {
  const stallRef = useRef<THREE.Group>(null);
  const btnWrapRef = useRef<HTMLDivElement>(null);

  const textures = useTexture([woodImg, canvasImg, clothesImg]);
  const woodTex = textures[0];
  const canvasTex = textures[1];
  const clothesTex = textures[2];

  woodTex.colorSpace = THREE.SRGBColorSpace;
  canvasTex.colorSpace = THREE.SRGBColorSpace;
  clothesTex.colorSpace = THREE.SRGBColorSpace;

  woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping;
  woodTex.repeat.set(2, 2);

  canvasTex.wrapS = canvasTex.wrapT = THREE.RepeatWrapping;
  canvasTex.repeat.set(3, 3);

  useFrame(({ camera }) => {
    if (stallRef.current && btnWrapRef.current) {
      const dist = camera.position.distanceTo(stallRef.current.position);
      if (dist < 22 && dist > 3) {
        btnWrapRef.current.style.opacity = '1';
        btnWrapRef.current.style.pointerEvents = 'auto';
      } else {
        btnWrapRef.current.style.opacity = '0';
        btnWrapRef.current.style.pointerEvents = 'none';
      }
    }
  });

  return (
    <group position={[position[0] + roadX(position[2]), position[1], position[2]]} ref={stallRef} rotation-y={-0.2 + Math.atan(roadSlope(position[2]))}>
      {/* Wooden Table Top */}
      <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.6, 0.1, 1.8]} />
        <meshStandardMaterial map={woodTex} roughness={0.8} />
      </mesh>

      {/* Table Legs */}
      {[
        [-1.7, 0.45, -0.8], [1.7, 0.45, -0.8],
        [-1.7, 0.45, 0.8], [1.7, 0.45, 0.8]
      ].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]} castShadow receiveShadow>
          <cylinderGeometry args={[0.08, 0.08, 0.9]} />
          <meshStandardMaterial map={woodTex} roughness={0.9} />
        </mesh>
      ))}

      {/* Canopy Poles */}
      {[
        [-1.7, 1.9, -0.8], [1.7, 1.9, -0.8],
        [-1.7, 1.9, 0.8], [1.7, 1.9, 0.8]
      ].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]} castShadow receiveShadow>
          <cylinderGeometry args={[0.06, 0.06, 3.8]} />
          <meshStandardMaterial map={woodTex} roughness={0.9} />
        </mesh>
      ))}

      {/* Canopy Roof */}
      <mesh position={[0, 3.9, 0]} castShadow receiveShadow rotation-x={-0.15}>
        <boxGeometry args={[4.2, 0.05, 2.4]} />
        <meshStandardMaterial map={canvasTex} roughness={1} />
      </mesh>

      {/* Folded Clothes Displays */}
      <mesh position={[-0.8, 1.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.8, 0.3, 0.8]} />
        <meshStandardMaterial map={clothesTex} roughness={1} />
      </mesh>
      <mesh position={[0.6, 1.05, 0.2]} castShadow receiveShadow>
        <boxGeometry args={[0.7, 0.2, 0.7]} />
        <meshStandardMaterial map={clothesTex} roughness={1} />
      </mesh>

      {/* Table Front Banner */}
      <Html position={[0, 0.5, 0.91]} transform center scale={0.008}>
        <div style={{
          background: 'rgba(20,20,20,0.85)',
          color: 'white',
          padding: '20px 40px',
          border: '4px solid #e9a9bd',
          borderRadius: '8px',
          fontFamily: 'sans-serif',
          fontWeight: 'bold',
          fontSize: '48px',
          width: '360px',
          textAlign: 'center',
          backdropFilter: 'blur(8px)',
          boxShadow: '0px 8px 20px rgba(0,0,0,0.5)',
        }}>
          UDGAM MERCH
        </div>
      </Html>

      <Html position={[0, 5, 0]} center>
        <div ref={btnWrapRef} style={{ transition: 'opacity 0.4s ease', opacity: 0, pointerEvents: 'none' }}>
          <div
            style={{
              background: 'white',
              padding: '12px 24px',
              borderRadius: '30px',
              boxShadow: '0 8px 16px rgba(0,0,0,0.15)',
              cursor: 'pointer',
              fontWeight: 'bold',
              color: '#e9a9bd',
              fontFamily: 'sans-serif',
              border: '3px solid #e9a9bd',
              whiteSpace: 'nowrap',
              transition: 'background 0.2s ease, color 0.2s ease, transform 0.2s ease',
            }}
            onPointerOver={(e) => {
              e.currentTarget.style.background = '#e9a9bd';
              e.currentTarget.style.color = 'white';
              e.currentTarget.style.transform = 'scale(1.1)';
            }}
            onPointerOut={(e) => {
              e.currentTarget.style.background = 'white';
              e.currentTarget.style.color = '#e9a9bd';
              e.currentTarget.style.transform = 'scale(1)';
            }}
            onClick={() => {
              window.location.href = '/merch';
            }}
          >
            🛍️ Shop Merch
          </div>
        </div>
      </Html>
    </group>
  );
}

/* ─── Playful Sakura Arcade & Event Registration Button ─── */
function GameArcadeZone({ position }: { position: [number, number, number] }) {
  const rootRef = useRef<THREE.Group>(null);
  const btnWrapRef = useRef<HTMLDivElement>(null);
  const starRef = useRef<THREE.Group>(null);
  const petalRef = useRef<THREE.Group>(null);
  const joystick1Ref = useRef<THREE.Group>(null);
  const joystick2Ref = useRef<THREE.Group>(null);
  const screenLightRef = useRef<THREE.PointLight>(null);

  const arcadeTex = useTexture(arcadeScreenImg);
  arcadeTex.colorSpace = THREE.SRGBColorSpace;

  useFrame(({ clock, camera }) => {
    const t = clock.elapsedTime;

    // Bobbing and rotating the floating blossom ornaments
    if (starRef.current) {
      starRef.current.rotation.y = t * 1.6;
      starRef.current.position.y = 2.4 + Math.sin(t * 2.2) * 0.16;
    }

    if (petalRef.current) {
      petalRef.current.rotation.y = -t * 1.3;
      petalRef.current.rotation.z = Math.sin(t * 1.5) * 0.2;
      petalRef.current.position.y = 2.6 + Math.cos(t * 1.8) * 0.16;
    }

    // Playful joystick wiggle
    if (joystick1Ref.current) {
      joystick1Ref.current.rotation.x = Math.sin(t * 3.0) * 0.15;
      joystick1Ref.current.rotation.z = Math.cos(t * 2.5) * 0.15;
    }
    if (joystick2Ref.current) {
      joystick2Ref.current.rotation.x = Math.cos(t * 2.7) * 0.15;
      joystick2Ref.current.rotation.z = Math.sin(t * 2.1) * 0.15;
    }

    // Gentle warm blossom screen light pulse
    if (screenLightRef.current) {
      screenLightRef.current.intensity = 1.4 + Math.sin(t * 3.2) * 0.4;
    }

    // Proximity fade and smooth float for the event registration button above
    if (rootRef.current && btnWrapRef.current) {
      const dist = camera.position.distanceTo(rootRef.current.position);
      if (dist < 32 && dist > 1.5) {
        const factor = Math.min(1, Math.max(0, (32 - dist) / 7));
        btnWrapRef.current.style.opacity = factor.toFixed(2);
        btnWrapRef.current.style.pointerEvents = factor > 0.4 ? 'auto' : 'none';
        btnWrapRef.current.style.transform = `scale(${0.92 + 0.08 * factor}) translateY(${Math.sin(t * 2.4) * 6}px)`;
      } else {
        btnWrapRef.current.style.opacity = '0';
        btnWrapRef.current.style.pointerEvents = 'none';
      }
    }
  });

  const posX = position[0] + roadX(position[2]);
  const posY = position[1];
  const posZ = position[2];
  const rotY = 0.35 + Math.atan(roadSlope(posZ));

  return (
    <group ref={rootRef} position={[posX, posY, posZ]} rotation-y={rotY}>
      {/* ── Soft Blossom Pedestal Platform ── */}
      <mesh position={[0, 0.04, 0]} receiveShadow>
        <cylinderGeometry args={[1.5, 1.65, 0.08, 20]} />
        <meshStandardMaterial color="#fff0f5" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.085, 0]}>
        <torusGeometry args={[1.48, 0.022, 8, 36]} rotation-x={Math.PI / 2} />
        <meshStandardMaterial color="#ff9ebb" emissive="#ff6584" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0, 0.086, 0]}>
        <torusGeometry args={[1.15, 0.016, 8, 36]} rotation-x={Math.PI / 2} />
        <meshStandardMaterial color="#f5c842" emissive="#d4a017" emissiveIntensity={0.5} />
      </mesh>

      {/* ── Cabinet Main Body (Sakura Candy Cab Theme) ── */}
      <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.36, 1.25, 0.98]} />
        <meshStandardMaterial color="#fff7f9" roughness={0.25} metalness={0.1} />
      </mesh>

      {/* ── Sakura Pink Side Trims & Edge Accents ── */}
      <mesh position={[-0.7, 1.45, 0]} castShadow>
        <boxGeometry args={[0.04, 1.85, 1.05]} />
        <meshStandardMaterial color="#ff80ab" roughness={0.3} />
      </mesh>
      <mesh position={[0.7, 1.45, 0]} castShadow>
        <boxGeometry args={[0.04, 1.85, 1.05]} />
        <meshStandardMaterial color="#ff80ab" roughness={0.3} />
      </mesh>

      {/* Front golden blossom highlight strips */}
      <mesh position={[-0.67, 0.72, 0.5]}>
        <boxGeometry args={[0.02, 1.2, 0.02]} />
        <meshStandardMaterial color="#f5c842" emissive="#d4a017" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0.67, 0.72, 0.5]}>
        <boxGeometry args={[0.02, 1.2, 0.02]} />
        <meshStandardMaterial color="#f5c842" emissive="#d4a017" emissiveIntensity={0.4} />
      </mesh>

      {/* ── Coin Door Panel (Warm Lacquer with Gold Slots) ── */}
      <mesh position={[0, 0.52, 0.5]}>
        <boxGeometry args={[0.62, 0.5, 0.02]} />
        <meshStandardMaterial color="#3a1c27" roughness={0.5} metalness={0.4} />
      </mesh>
      {[-0.14, 0.14].map((cx, i) => (
        <group key={i} position={[cx, 0.6, 0.52]}>
          <mesh>
            <boxGeometry args={[0.1, 0.14, 0.02]} />
            <meshStandardMaterial color="#4d2434" roughness={0.3} />
          </mesh>
          <mesh position={[0, 0, 0.012]}>
            <boxGeometry args={[0.02, 0.07, 0.01]} />
            <meshStandardMaterial color="#f5c842" emissive="#e8a000" emissiveIntensity={0.8} />
          </mesh>
        </group>
      ))}

      {/* ── Slanted Control Deck (Sakura Blossom Pink) ── */}
      <mesh position={[0, 1.28, 0.22]} rotation-x={0.26} castShadow receiveShadow>
        <boxGeometry args={[1.4, 0.16, 0.62]} />
        <meshStandardMaterial color="#ffccd5" roughness={0.35} metalness={0.15} />
      </mesh>
      {/* Control panel deck gold trim */}
      <mesh position={[0, 1.34, 0.16]} rotation-x={0.26}>
        <boxGeometry args={[1.36, 0.01, 0.04]} />
        <meshStandardMaterial color="#f5c842" emissive="#d4a017" emissiveIntensity={0.5} />
      </mesh>

      {/* Player 1 Joystick (Sakura Pink Ball) */}
      <group ref={joystick1Ref} position={[-0.36, 1.35, 0.22]}>
        <mesh position={[0, 0.01, 0]}>
          <cylinderGeometry args={[0.07, 0.08, 0.02, 12]} />
          <meshStandardMaterial color="#4a2c38" metalness={0.7} />
        </mesh>
        <mesh position={[0, 0.1, 0]}>
          <cylinderGeometry args={[0.014, 0.014, 0.18, 8]} />
          <meshStandardMaterial color="#e0e0e0" metalness={0.9} roughness={0.1} />
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <sphereGeometry args={[0.065, 14, 12]} />
          <meshStandardMaterial color="#ff6699" emissive="#ff3377" emissiveIntensity={0.4} roughness={0.2} />
        </mesh>
      </group>

      {/* Player 2 Joystick (Blossom Gold Ball) */}
      <group ref={joystick2Ref} position={[0.36, 1.35, 0.22]}>
        <mesh position={[0, 0.01, 0]}>
          <cylinderGeometry args={[0.07, 0.08, 0.02, 12]} />
          <meshStandardMaterial color="#4a2c38" metalness={0.7} />
        </mesh>
        <mesh position={[0, 0.1, 0]}>
          <cylinderGeometry args={[0.014, 0.014, 0.18, 8]} />
          <meshStandardMaterial color="#e0e0e0" metalness={0.9} roughness={0.1} />
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <sphereGeometry args={[0.065, 14, 12]} />
          <meshStandardMaterial color="#f5c842" emissive="#d4a017" emissiveIntensity={0.4} roughness={0.2} />
        </mesh>
      </group>

      {/* Arcade Action Buttons (Sakura Petal & Gold Palette) */}
      {[
        { x: -0.18, y: 1.38, z: 0.28, c: "#ff6699" },
        { x: -0.10, y: 1.36, z: 0.22, c: "#ffffff" },
        { x: -0.02, y: 1.34, z: 0.16, c: "#f5c842" },
        { x: 0.54, y: 1.38, z: 0.28, c: "#f5c842" },
        { x: 0.62, y: 1.36, z: 0.22, c: "#ffffff" },
        { x: 0.70, y: 1.34, z: 0.16, c: "#ff6699" },
      ].map((btn, i) => (
        <mesh key={i} position={[btn.x, btn.y, btn.z]}>
          <cylinderGeometry args={[0.035, 0.04, 0.03, 10]} />
          <meshStandardMaterial color={btn.c} roughness={0.3} />
        </mesh>
      ))}

      {/* ── Screen Housing & Direct 3D High-Res Poster Display ── */}
      <group position={[0, 1.88, 0.08]} rotation-x={-0.22}>
        {/* Outer Cabinet Bezel Housing */}
        <mesh castShadow>
          <boxGeometry args={[1.36, 1.06, 0.35]} />
          <meshStandardMaterial color="#2e1723" roughness={0.4} />
        </mesh>

        {/* Outer Sakura Glowing Frame Trim */}
        <mesh position={[0, 0, 0.176]}>
          <planeGeometry args={[1.26, 0.88]} />
          <meshStandardMaterial color="#ff9ebb" emissive="#ff6584" emissiveIntensity={0.6} />
        </mesh>

        {/* Inner Black Bezel Frame */}
        <mesh position={[0, 0, 0.178]}>
          <planeGeometry args={[1.22, 0.84]} />
          <meshStandardMaterial color="#0c0408" roughness={0.9} />
        </mesh>

        {/* The Real Minecraft Udgam Festival Poster Texture (100% luminous & crisp) */}
        <mesh position={[0, 0, 0.182]}>
          <planeGeometry args={[1.20, 0.80]} />
          <meshBasicMaterial map={arcadeTex} toneMapped={false} />
        </mesh>

        {/* Subtle Arcade Screen Glass Glare Sheen */}
        <mesh position={[0, 0, 0.184]}>
          <planeGeometry args={[1.20, 0.80]} />
          <meshStandardMaterial
            color="#ffffff"
            transparent
            opacity={0.07}
            roughness={0.08}
            metalness={0.7}
          />
        </mesh>
      </group>

      {/* Screen Illumination Glow */}
      <pointLight ref={screenLightRef} position={[0, 1.95, 0.7]} color="#ff9ebb" intensity={1.8} distance={6} decay={2} />

      {/* ── Top Marquee Hood & Banner ── */}
      <mesh position={[0, 2.68, 0.22]} castShadow>
        <boxGeometry args={[1.42, 0.42, 0.52]} />
        <meshStandardMaterial color="#fff7f9" roughness={0.3} />
      </mesh>
      <Html position={[0, 2.68, 0.49]} transform center scale={0.007}>
        <div style={{
          background: 'linear-gradient(135deg, #ff80ab, #f06292)',
          color: '#ffffff',
          fontWeight: '900',
          fontSize: '30px',
          letterSpacing: '3px',
          padding: '8px 22px',
          borderRadius: '8px',
          border: '2px solid #ffffff',
          boxShadow: '0 0 18px rgba(255,128,171,0.6)',
          whiteSpace: 'nowrap',
          fontFamily: '"Quicksand", "Inter", sans-serif',
          textShadow: '0 1px 4px rgba(0,0,0,0.25)',
          userSelect: 'none',
        }}>
          🌸 UDGAM ARCADE 🌸
        </div>
      </Html>

      {/* ── Floating Cherry Blossom Petal / Flower Ornament (Left Side) ── */}
      <group ref={petalRef} position={[-1.3, 2.5, 0.15]}>
        <mesh castShadow>
          <sphereGeometry args={[0.26, 12, 10]} />
          <meshStandardMaterial color="#ff8da7" emissive="#ff6584" emissiveIntensity={0.7} roughness={0.3} />
        </mesh>
      </group>

      {/* ── Floating Golden Blossom Star (Right Side) ── */}
      <group ref={starRef} position={[1.3, 2.2, 0.15]}>
        <mesh castShadow>
          <octahedronGeometry args={[0.26, 0]} />
          <meshStandardMaterial color="#f5c842" emissive="#d4a017" emissiveIntensity={0.9} metalness={0.7} roughness={0.2} />
        </mesh>
      </group>

      {/* ── Clean Floating "Register for Events" Button Above ── */}
      <Html position={[0, 3.8, 0]} center>
        <div
          ref={btnWrapRef}
          style={{
            opacity: 0,
            transform: 'scale(0.92)',
            transition: 'opacity 0.35s ease, transform 0.35s ease',
            pointerEvents: 'none',
            userSelect: 'none',
            fontFamily: '"Quicksand", "Inter", sans-serif',
          }}
        >
          <button
            style={{
              background: 'linear-gradient(135deg, #ff758c 0%, #ff7eb3 50%, #e05375 100%)',
              color: '#ffffff',
              border: '2px solid rgba(255, 255, 255, 0.85)',
              borderRadius: '9999px',
              padding: '13px 32px',
              fontSize: '16px',
              fontWeight: '800',
              letterSpacing: '0.6px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 10px 28px rgba(224, 83, 117, 0.45), 0 0 20px rgba(255, 126, 179, 0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            }}
            onPointerOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px) scale(1.06)';
              e.currentTarget.style.boxShadow = '0 14px 34px rgba(224, 83, 117, 0.65), 0 0 26px rgba(255, 126, 179, 0.55)';
            }}
            onPointerOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 10px 28px rgba(224, 83, 117, 0.45), 0 0 20px rgba(255, 126, 179, 0.35)';
            }}
            onClick={() => {
              window.location.href = '/events';
            }}
          >
            <span>🌸</span>
            <span>Register for Events</span>
          </button>
        </div>
      </Html>
    </group>
  );
}

/* ─── 3D Sponsor Billboards (Domino's & Quarks Technosoft) ── */
function SponsorBillboard({
  position,
  rotationY = 0,
  sponsor,
}: {
  position: [number, number, number];
  rotationY?: number;
  sponsor: 'dominos' | 'quarks';
}) {
  const posX = position[0] + roadX(position[2]);
  const posY = position[1];
  const posZ = position[2];

  const dominosTex = useTexture(dominosImg);
  const quarksTex = useTexture(quarksImg);
  useMemo(() => {
    dominosTex.colorSpace = THREE.SRGBColorSpace;
    quarksTex.colorSpace = THREE.SRGBColorSpace;
  }, [dominosTex, quarksTex]);

  const activeTex = sponsor === 'dominos' ? dominosTex : quarksTex;

  return (
    <group position={[posX, posY, posZ]} rotation-y={rotationY}>
      {/* Heavy-Duty Concrete Base Footings */}
      {[-2.2, 2.2].map((x, i) => (
        <mesh key={i} position={[x, 0.25, 0]} receiveShadow>
          <boxGeometry args={[0.9, 0.5, 0.9]} />
          <meshStandardMaterial color="#888c94" roughness={0.92} />
        </mesh>
      ))}

      {/* Structural Steel Support Pillars */}
      {[-2.2, 2.2].map((x, i) => (
        <mesh key={i} position={[x, 2.4, 0]} castShadow>
          <cylinderGeometry args={[0.12, 0.12, 4.6, 12]} />
          <meshStandardMaterial color="#2d323b" metalness={0.8} roughness={0.35} />
        </mesh>
      ))}

      {/* Heavy-Duty Steel Cross Braces */}
      <mesh position={[0, 2.2, 0]} rotation-z={0.65}>
        <cylinderGeometry args={[0.04, 0.04, 5.0, 8]} />
        <meshStandardMaterial color="#252a33" metalness={0.7} roughness={0.4} />
      </mesh>
      <mesh position={[0, 2.2, 0]} rotation-z={-0.65}>
        <cylinderGeometry args={[0.04, 0.04, 5.0, 8]} />
        <meshStandardMaterial color="#252a33" metalness={0.7} roughness={0.4} />
      </mesh>

      {/* Main Billboard Board Backing */}
      <mesh position={[0, 5.2, 0]} castShadow>
        <boxGeometry args={[9.0, 5.3, 0.25]} />
        <meshStandardMaterial color="#1a1c22" metalness={0.75} roughness={0.3} />
      </mesh>

      {/* Outer Illuminated Border Trim */}
      <mesh position={[0, 5.2, 0.15]}>
        <planeGeometry args={[8.6, 4.9]} />
        <meshStandardMaterial
          color={sponsor === 'dominos' ? '#e31837' : '#00f0ff'}
          emissive={sponsor === 'dominos' ? '#cc1430' : '#00a0cc'}
          emissiveIntensity={0.6}
        />
      </mesh>

      {/* High-Resolution Commercial Sponsor Graphic Billboard Texture (100% luminous & crisp) */}
      <mesh position={[0, 5.2, 0.18]}>
        <planeGeometry args={[8.35, 4.7]} />
        <meshBasicMaterial map={activeTex} toneMapped={false} />
      </mesh>

      {/* Subtle Screen Glass Sheen */}
      <mesh position={[0, 5.2, 0.2]}>
        <planeGeometry args={[8.35, 4.7]} />
        <meshStandardMaterial
          color="#ffffff"
          transparent
          opacity={0.06}
          roughness={0.1}
          metalness={0.8}
        />
      </mesh>

      {/* Triple Overhead Spotlight Gantries & Fixtures */}
      {[-2.6, 0, 2.6].map((x, i) => (
        <group key={i} position={[x, 7.9, 0]}>
          {/* Extension Arm */}
          <mesh position={[0, 0, 0.45]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.035, 0.035, 0.9, 8]} />
            <meshStandardMaterial color="#2d323b" metalness={0.8} />
          </mesh>
          {/* Lamp Head */}
          <mesh position={[0, -0.06, 0.9]} rotation-x={0.45}>
            <boxGeometry args={[0.5, 0.15, 0.3]} />
            <meshStandardMaterial color="#1f232b" metalness={0.7} />
          </mesh>
          {/* Emissive Lamp Lens */}
          <mesh position={[0, -0.15, 0.9]} rotation-x={0.45}>
            <planeGeometry args={[0.45, 0.22]} />
            <meshStandardMaterial color="#fffbe6" emissive="#ffeaad" emissiveIntensity={1.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ─── Distant Himalayan Mountains (Kangchenjunga Range Panorama) ─── */
function DistantHimalayas() {
  const mountainTex = useTexture(mountainImg);
  useMemo(() => {
    mountainTex.colorSpace = THREE.SRGBColorSpace;
    mountainTex.anisotropy = 16;
    mountainTex.wrapS = THREE.ClampToEdgeWrapping;
    mountainTex.wrapT = THREE.ClampToEdgeWrapping;
  }, [mountainTex]);

  // Sweeping panoramic curved amphitheater geometry (190° seamless horizon wrap, stretched tall)
  const curvedGeo = useMemo(() => {
    const segments = 80;
    const radius = 250;
    // Sweeps from -95 degrees to +95 degrees (wraps around the full horizon)
    const startAngle = -Math.PI * 0.53;
    const endAngle = Math.PI * 0.53;
    const height = 230; // Tall stretch reaching high into the sky dome
    const yBottom = -30;
    const yTop = yBottom + height;
    const centerZ = -55;

    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const angle = startAngle + t * (endAngle - startAngle);
      const x = Math.sin(angle) * radius;
      const z = centerZ - Math.cos(angle) * radius;

      // Bottom vertex
      positions.push(x, yBottom, z);
      uvs.push(t, 0);

      // Top vertex
      positions.push(x, yTop, z);
      uvs.push(t, 1);

      if (i < segments) {
        const b = i * 2;
        // Inward facing triangles for interior horizon view
        indices.push(b, b + 2, b + 1);
        indices.push(b + 1, b + 2, b + 3);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, []);

  // Custom shader that seamlessly melts the top sky portion into the scene's background color
  const mountainShader = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: mountainTex },
        uSkyColor: { value: new THREE.Color("#dbe7fb") },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uMap;
        uniform vec3 uSkyColor;
        varying vec2 vUv;
        void main() {
          vec4 col = texture2D(uMap, vUv);
          // Softly melt the upper sky portion into the infinite canvas sky color (no top border)
          float factor = smoothstep(0.62, 0.94, vUv.y);
          vec3 finalRgb = mix(col.rgb, uSkyColor, factor);
          gl_FragColor = vec4(finalRgb, 1.0);
        }
      `,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }, [mountainTex]);

  const mistRef = useRef<THREE.Group>(null);

  useFrame(({ clock, scene }) => {
    if (mistRef.current) {
      mistRef.current.position.x = Math.sin(clock.elapsedTime * 0.05) * 4;
    }
    // Keep the sky blend color synced with scene background
    const bg = scene.background as THREE.Color;
    if (bg && bg.r !== undefined) {
      mountainShader.uniforms.uSkyColor.value.copy(bg);
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* ── Main Expansive Stretched Panoramic Curved Himalayan Horizon ── */}
      <mesh geometry={curvedGeo} material={mountainShader} renderOrder={-10} />

      {/* ── Secondary Subtle Horizon Mist / Floating Cloud Wisps ── */}
      <group ref={mistRef} position={[0, 4, -140]}>
        <mesh position={[-60, 0, 0]} renderOrder={-9}>
          <planeGeometry args={[180, 24]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.15}
            fog={false}
            depthWrite={false}
          />
        </mesh>
        <mesh position={[60, 2, 0]} renderOrder={-9}>
          <planeGeometry args={[200, 26]} />
          <meshBasicMaterial
            color="#ffeef4"
            transparent
            opacity={0.12}
            fog={false}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  );
}

/* ─── Root ───────────────────────────────────────────── */
/* ─── Loading signals for the page's loader ──────────── */
/** Reports texture loading progress (0..1) while the scene's assets download. */
function LoadProgress({ onProgress }: { onProgress?: ((p: number) => void) | undefined }) {
  const { progress } = useProgress();
  useEffect(() => {
    onProgress?.(progress / 100);
  }, [progress, onProgress]);
  return null;
}

/** Mounted inside the Suspense boundary: fires once every asset is loaded and 2 frames have drawn. */
function ReadySignal({ onReady }: { onReady?: (() => void) | undefined }) {
  const frames = useRef(0);
  const fired = useRef(false);
  useFrame(() => {
    if (fired.current) return;
    frames.current += 1;
    if (frames.current >= 2) {
      fired.current = true;
      onReady?.();
    }
  });
  return null;
}

export function BlossomScene({
  progress,
  low,
  paused = false,
  onLoadProgress,
  onReady,
}: {
  progress: React.MutableRefObject<number>;
  low: boolean;
  paused?: boolean;
  onLoadProgress?: (p: number) => void;
  onReady?: () => void;
}) {
  // Drops resolution automatically if the frame rate can't keep up
  const [dpr, setDpr] = useState(1.5);
  const [lowDpr, setLowDpr] = useState(1);
  return (
    <Canvas
      shadows={!low}
      dpr={low ? lowDpr : dpr}
      frameloop={paused ? "never" : "always"}
      camera={{ fov: 60, position: [0, 1.7, 10] }}
      gl={{ antialias: !low, powerPreference: "high-performance" }}
    >
      <PerformanceMonitor
        onDecline={() => (low ? setLowDpr(0.75) : setDpr(1))}
        onIncline={() => (low ? setLowDpr(1) : setDpr(1.5))}
        flipflops={3}
        onFallback={() => (low ? setLowDpr(0.75) : setDpr(1))}
      />
      <color attach="background" args={["#dbe7fb"]} />
      <fog attach="fog" args={["#dbe7fb", 10, 68]} />
      <ambientLight intensity={0.7} color="#f0f4ff" />
      <hemisphereLight args={["#e8efff", "#d2dec9", 0.6]} />
      <Environment resolution={32}>
        <Lightformer intensity={2} position={[0, 6, 0]} scale={[10, 10, 1]} color="#fff" />
        <Lightformer intensity={1} color="#ffc0d6" position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 1, 1]} />
      </Environment>
      <CameraRig progress={progress} />
      <LoadProgress onProgress={onLoadProgress} />
      <Suspense fallback={null}>
        <DistantHimalayas />
        <Ground />
        <Forest low={low} />
        <BackgroundTrees low={low} />
        <ForestSign label="NIT SIKKIM" position={[2.4, 0, -12]} rotation={-0.12} accent="#d9b66f" />
        <GameArcadeZone position={[-3.2, 0, -22]} />
        <ForestSign label="UDGAM 2K26" position={[-2.6, 0, -32]} rotation={0.14} accent="#e9a9bd" />
        <MerchStall position={[3.8, 0, -50]} />
        {/* End of journey monumental sponsor billboards on open ground */}
        <SponsorBillboard position={[-8.2, 0, -82]} rotationY={0.25} sponsor="dominos" />
        <SponsorBillboard position={[8.2, 0, -82]} rotationY={-0.25} sponsor="quarks" />
        <HotAirBalloon progress={progress} />
        <ReadySignal onReady={onReady} />
      </Suspense>
      <Petals count={low ? 700 : 4500} progress={progress} />
    </Canvas>
  );
}