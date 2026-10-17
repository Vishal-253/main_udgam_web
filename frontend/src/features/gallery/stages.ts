import * as THREE from "three";

// Animated performance stages for the 3D Memory Grove, shown in the slots of editions that
// have no photos. Everything is plain meshes with basic/standard materials and no extra lights
// or shadows, so three stages cost about as much as a few billboards.

export type StageKind = "singers" | "dancers" | "band";

export interface Stage {
  kind: StageKind;
  color: string;
  position: THREE.Vector3;
  update: (t: number) => void;
}

const STAGE_INFO: Record<
  StageKind,
  { title: string; subtitle: string; color: string; accent: string }
> = {
  singers: {
    title: "VOICES OF UDGAM",
    subtitle: "Solo  •  Duet  •  Acoustic",
    color: "#f472b6",
    accent: "#7c3aed",
  },
  dancers: {
    title: "DANCE ARENA",
    subtitle: "Folk  •  Hip-hop  •  Freestyle",
    color: "#fbbf24",
    accent: "#db2777",
  },
  band: {
    title: "BATTLE OF BANDS",
    subtitle: "Rock  •  Fusion  •  Live",
    color: "#60a5fa",
    accent: "#2563eb",
  },
};

const STAGE_W = 12;
const STAGE_D = 7;
const DECK_Y = 0.9; // top of the platform, where performers stand
const BEAM_Y = 8;
const FIG = 1.35; // performer scale, so they read clearly from the walkway

const SKIN = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524];
const HAIR = [0x1a1110, 0x2b1b12, 0x3b2314, 0x0d0d0d];

// ── shared geometry for one scene (disposed with the scene) ──────────────────
function createKit() {
  return {
    leg: new THREE.CylinderGeometry(0.11, 0.09, 1, 8).translate(0, -0.5, 0),
    torso: new THREE.CylinderGeometry(0.3, 0.24, 0.85, 10).translate(0, 0.43, 0),
    head: new THREE.SphereGeometry(0.22, 14, 10),
    hair: new THREE.SphereGeometry(0.235, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    arm: new THREE.CylinderGeometry(0.08, 0.07, 0.8, 8).translate(0, -0.4, 0),
    pole: new THREE.CylinderGeometry(0.025, 0.025, 1, 6),
    mic: new THREE.SphereGeometry(0.07, 8, 6),
    cone: new THREE.ConeGeometry(1.5, 7, 20, 1, true).translate(0, -3.5, 0),
    box: new THREE.BoxGeometry(1, 1, 1),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 18),
  };
}
type Kit = ReturnType<typeof createKit>;

function radialGlow() {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  const g = cv.getContext("2d");
  if (g) {
    const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    rg.addColorStop(0, "rgba(255,255,255,0.9)");
    rg.addColorStop(0.5, "rgba(255,255,255,0.3)");
    rg.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = rg;
    g.fillRect(0, 0, 128, 128);
  }
  return new THREE.CanvasTexture(cv);
}

// ── a simple performer: legs and a body group (torso, head, arms) that can sway ──
interface Figure {
  root: THREE.Group;
  body: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
}

function makeFigure(kit: Kit, outfit: number, seed: number): Figure {
  const root = new THREE.Group();
  const outfitMat = new THREE.MeshStandardMaterial({ color: outfit, roughness: 0.6 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1f1b2e, roughness: 0.8 });
  const skinMat = new THREE.MeshStandardMaterial({
    color: SKIN[seed % SKIN.length]!,
    roughness: 0.7,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: HAIR[seed % HAIR.length]!,
    roughness: 0.9,
  });

  const legL = new THREE.Group();
  const legR = new THREE.Group();
  [legL, legR].forEach((leg, i) => {
    leg.position.set(i === 0 ? -0.14 : 0.14, 1, 0);
    leg.add(new THREE.Mesh(kit.leg, pantsMat));
    root.add(leg);
  });

  const body = new THREE.Group();
  body.position.y = 1;
  body.add(new THREE.Mesh(kit.torso, outfitMat));
  const head = new THREE.Mesh(kit.head, skinMat);
  head.position.y = 1.1;
  body.add(head);
  const hair = new THREE.Mesh(kit.hair, hairMat);
  hair.position.y = 1.14;
  body.add(hair);

  const armL = new THREE.Group();
  const armR = new THREE.Group();
  [armL, armR].forEach((arm, i) => {
    arm.position.set(i === 0 ? -0.36 : 0.36, 0.8, 0);
    arm.add(new THREE.Mesh(kit.arm, outfitMat));
    body.add(arm);
  });
  root.add(body);
  root.scale.setScalar(FIG);
  return { root, body, armL, armR, legL, legR };
}

function micStand(kit: Kit, height: number) {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.8, roughness: 0.3 });
  const pole = new THREE.Mesh(kit.pole, metal);
  pole.scale.y = height;
  pole.position.y = height / 2;
  g.add(pole);
  const mic = new THREE.Mesh(kit.mic, new THREE.MeshStandardMaterial({ color: 0x222222 }));
  mic.position.y = height + 0.05;
  g.add(mic);
  return g;
}

function box(
  kit: Kit,
  mat: THREE.Material,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
) {
  const m = new THREE.Mesh(kit.box, mat);
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  return m;
}

function cylinder(
  kit: Kit,
  mat: THREE.Material,
  r: number,
  h: number,
  x: number,
  y: number,
  z: number,
) {
  const m = new THREE.Mesh(kit.cyl, mat);
  m.scale.set(r, h, r);
  m.position.set(x, y, z);
  return m;
}

function screenTexture(kind: StageKind) {
  const info = STAGE_INFO[kind];
  const W = 1024,
    H = 512;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d");
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#0b0618");
    grad.addColorStop(0.55, info.accent + "aa");
    grad.addColorStop(1, "#0b0618");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    // starry dots
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.15 + ((i * 37) % 50) / 100})`;
      ctx.beginPath();
      ctx.arc((i * 211) % W, (i * 97) % H, 1 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.textAlign = "center";
    ctx.shadowColor = info.color;
    ctx.shadowBlur = 30;
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 104px 'Outfit', sans-serif";
    ctx.fillText(info.title, W / 2, 230, W - 80);
    ctx.shadowBlur = 0;
    ctx.fillStyle = info.color;
    ctx.font = "600 46px 'Outfit', sans-serif";
    ctx.fillText(info.subtitle, W / 2, 310);
    ctx.font = "700 34px 'Outfit', sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillText("UDGAM 2K26  •  LIVE", W / 2, 380);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function noteTexture(color: string) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  const ctx = cv.getContext("2d");
  if (ctx) {
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.font = "bold 100px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("♪", 64, 64);
  }
  return new THREE.CanvasTexture(cv);
}

// ── the stage shell shared by all three kinds ─────────────────────────────────
function buildShell(kit: Kit, group: THREE.Group, kind: StageKind) {
  const info = STAGE_INFO[kind];
  const deckMat = new THREE.MeshStandardMaterial({
    color: 0x1b1030,
    roughness: 0.5,
    metalness: 0.2,
  });
  const trussMat = new THREE.MeshStandardMaterial({
    color: 0x6b6b7a,
    metalness: 0.8,
    roughness: 0.35,
  });
  const ledMat = new THREE.MeshBasicMaterial({ color: info.color });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
  const grilleMat = new THREE.MeshStandardMaterial({
    color: 0x333333,
    roughness: 0.5,
    metalness: 0.4,
  });

  group.add(box(kit, deckMat, STAGE_W, DECK_Y, STAGE_D, 0, DECK_Y / 2, 0));
  group.add(box(kit, ledMat, STAGE_W, 0.1, 0.06, 0, DECK_Y - 0.06, STAGE_D / 2 + 0.03));
  group.add(box(kit, deckMat, 3, DECK_Y / 2, 0.9, 0, DECK_Y / 4, STAGE_D / 2 + 0.45));

  // truss: four pillars, front and back beams
  for (const x of [-STAGE_W / 2, STAGE_W / 2]) {
    for (const z of [-STAGE_D / 2 + 0.2, STAGE_D / 2 - 0.2]) {
      group.add(box(kit, trussMat, 0.3, BEAM_Y, 0.3, x, BEAM_Y / 2, z));
    }
  }
  for (const z of [-STAGE_D / 2 + 0.2, STAGE_D / 2 - 0.2]) {
    group.add(box(kit, trussMat, STAGE_W + 0.3, 0.3, 0.3, 0, BEAM_Y, z));
  }

  // LED backdrop
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(STAGE_W - 1, 5),
    new THREE.MeshBasicMaterial({ map: screenTexture(kind) }),
  );
  screen.position.set(0, DECK_Y + 3.3, -STAGE_D / 2 + 0.35);
  group.add(screen);
  group.add(box(kit, darkMat, STAGE_W - 0.6, 5.4, 0.2, 0, DECK_Y + 3.3, -STAGE_D / 2 + 0.2));

  // speakers on both front corners
  for (const x of [-STAGE_W / 2 + 0.9, STAGE_W / 2 - 0.9]) {
    group.add(box(kit, darkMat, 1.1, 1.9, 0.9, x, DECK_Y + 0.95, STAGE_D / 2 - 0.9));
    for (const y of [0.5, 1.35]) {
      const cone = cylinder(kit, grilleMat, 0.32, 0.05, x, DECK_Y + y, STAGE_D / 2 - 0.43);
      cone.rotation.x = Math.PI / 2;
      group.add(cone);
    }
  }

  // equalizer bars along the bottom of the screen
  const eqMat = new THREE.MeshBasicMaterial({ color: info.color });
  const eqBars: THREE.Mesh[] = [];
  const EQ = 16;
  for (let i = 0; i < EQ; i++) {
    const bar = box(
      kit,
      eqMat,
      0.42,
      1,
      0.08,
      -((EQ - 1) / 2) * 0.62 + i * 0.62,
      0,
      -STAGE_D / 2 + 0.5,
    );
    eqBars.push(bar);
    group.add(bar);
  }

  // swinging spotlight beams hung from the front beam
  const beams: { pivot: THREE.Group; mat: THREE.MeshBasicMaterial; phase: number }[] = [];
  [-4, -1.4, 1.4, 4].forEach((x, i) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, BEAM_Y - 0.2, STAGE_D / 2 - 0.2);
    const mat = new THREE.MeshBasicMaterial({
      color: info.color,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    pivot.add(new THREE.Mesh(kit.cone, mat));
    pivot.add(cylinder(kit, darkMat, 0.25, 0.5, 0, 0, 0));
    group.add(pivot);
    beams.push({ pivot, mat, phase: i * 1.3 });
  });

  // coloured glow on the ground in front of the stage
  const glowMat = new THREE.MeshBasicMaterial({
    color: info.color,
    map: radialGlow(),
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(18, 10), glowMat);
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(0, 0.07, STAGE_D / 2 + 3);
  group.add(glow);

  const baseHue = new THREE.Color(info.color).getHSL({ h: 0, s: 0, l: 0 }).h;
  return (t: number) => {
    eqBars.forEach((bar, i) => {
      const h = 0.2 + Math.abs(Math.sin(t * 6 + i * 0.7) * Math.cos(t * 2.3 + i * 1.9)) * 0.8;
      bar.scale.y = h;
      bar.position.y = DECK_Y + h / 2;
    });
    beams.forEach((b, i) => {
      b.pivot.rotation.z = Math.sin(t * 0.9 + b.phase) * 0.45;
      b.pivot.rotation.x = 0.35 + Math.sin(t * 0.7 + b.phase) * 0.2; // tilt back onto the performers
      b.mat.color.setHSL((baseHue + t * 0.05 + i * 0.12) % 1, 0.9, 0.6);
    });
    glowMat.opacity = 0.35 + Math.sin(t * 3) * 0.08;
  };
}

// ── performers ────────────────────────────────────────────────────────────────
function buildSingers(kit: Kit, group: THREE.Group, color: string) {
  const singers = [
    { x: 0, z: 1.2, outfit: 0xe11d48 },
    { x: -2.8, z: -0.4, outfit: 0x7c3aed },
    { x: 2.8, z: -0.4, outfit: 0x0ea5e9 },
  ].map((s, i) => {
    const f = makeFigure(kit, s.outfit, i);
    f.root.position.set(s.x, DECK_Y, s.z);
    const stand = micStand(kit, 1.95 * FIG);
    stand.position.set(s.x, DECK_Y, s.z + 0.65);
    group.add(f.root, stand);
    return f;
  });

  const noteMat = new THREE.SpriteMaterial({
    map: noteTexture(color),
    transparent: true,
    depthWrite: false,
  });
  const notes = Array.from({ length: 8 }, (_, i) => {
    const s = new THREE.Sprite(noteMat.clone());
    s.scale.setScalar(0.7);
    group.add(s);
    return { s, phase: i / 8 };
  });

  return (t: number) => {
    singers.forEach((f, i) => {
      const sway = Math.sin(t * 1.6 + i * 0.8);
      f.body.rotation.z = sway * 0.08;
      f.body.rotation.y = sway * 0.15;
      f.root.position.y = DECK_Y + Math.abs(Math.sin(t * 3.2 + i)) * 0.04;
      if (i === 0) {
        // lead: one hand on the mic, the other sweeping up with the high notes
        f.armR.rotation.x = -1.2;
        f.armL.rotation.z = -1.2 - Math.sin(t * 1.3) * 0.7;
      } else {
        f.armL.rotation.z = -0.3 + sway * 0.15;
        f.armR.rotation.z = 0.3 + sway * 0.15;
      }
    });
    notes.forEach(({ s, phase }) => {
      const p = (t * 0.25 + phase) % 1;
      s.position.set(Math.sin(phase * 40 + p * 4) * 2.5, DECK_Y + 2.4 + p * 4.5, 1.2 - p);
      (s.material as THREE.SpriteMaterial).opacity = Math.sin(p * Math.PI);
    });
  };
}

function buildDancers(kit: Kit, group: THREE.Group) {
  const spots = [
    [0, 1.6],
    [-2.2, 0.6],
    [2.2, 0.6],
    [-4.2, -0.5],
    [4.2, -0.5],
  ];
  const outfits = [0xfbbf24, 0xec4899, 0x22d3ee, 0xa3e635, 0xf97316];
  const dancers = spots.map(([x, z], i) => {
    const f = makeFigure(kit, outfits[i]!, i + 1);
    f.root.position.set(x!, DECK_Y, z!);
    group.add(f.root);
    return f;
  });

  // disco ball over the floor
  const ball = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.6, 1),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 1,
      roughness: 0.15,
      flatShading: true,
      emissive: 0x444466,
    }),
  );
  ball.position.set(0, BEAM_Y - 1.4, 0.8);
  group.add(ball);
  const string = new THREE.Mesh(kit.pole, new THREE.MeshBasicMaterial({ color: 0x888888 }));
  string.scale.y = 1.1;
  string.position.set(0, BEAM_Y - 0.6, 0.8);
  group.add(string);

  return (t: number) => {
    ball.rotation.y = t * 0.8;
    const move = Math.floor(t / 4) % 3; // switch routine every 4 seconds
    const beat = t * 5;
    dancers.forEach((f, i) => {
      const b = Math.sin(beat + (move === 2 ? i * 0.6 : 0));
      f.root.position.y = DECK_Y + Math.max(0, b) * 0.25;
      f.legL.rotation.x = 0;
      f.legR.rotation.x = 0;
      f.root.rotation.y = 0;
      if (move === 0) {
        // hands up, waving side to side
        f.armL.rotation.z = -2.6 + b * 0.3;
        f.armR.rotation.z = 2.6 + b * 0.3;
        f.armL.rotation.x = f.armR.rotation.x = 0;
        f.body.rotation.z = b * 0.12;
      } else if (move === 1) {
        // spin with arms out
        f.root.rotation.y = (t % 4) * Math.PI * 0.5 * (i % 2 ? 1 : -1);
        f.armL.rotation.z = -1.5;
        f.armR.rotation.z = 1.5;
        f.armL.rotation.x = f.armR.rotation.x = 0;
        f.body.rotation.z = 0;
      } else {
        // wave through the line: alternating punches and kicks
        f.armL.rotation.z = -0.2;
        f.armR.rotation.z = 0.2;
        f.armL.rotation.x = b > 0 ? -2.2 : -0.3;
        f.armR.rotation.x = b > 0 ? -0.3 : -2.2;
        f.legL.rotation.x = b > 0 ? -0.6 : 0;
        f.legR.rotation.x = b > 0 ? 0 : -0.6;
        f.body.rotation.z = 0;
      }
    });
  };
}

function buildBand(kit: Kit, group: THREE.Group) {
  const shell = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.4, metalness: 0.3 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xf5f5f4, roughness: 0.6 });
  const brass = new THREE.MeshStandardMaterial({
    color: 0xd4a017,
    metalness: 0.9,
    roughness: 0.25,
  });
  const black = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.5 });

  // drum riser + kit at the back
  group.add(box(kit, black, 4, 0.5, 2.4, 0, DECK_Y + 0.25, -1.6));
  const top = DECK_Y + 0.5;
  const kick = cylinder(kit, shell, 0.55, 0.5, 0, top + 0.55, -0.7);
  kick.rotation.x = Math.PI / 2;
  group.add(kick);
  const kickFace = cylinder(kit, skin, 0.5, 0.02, 0, top + 0.55, -0.44);
  kickFace.rotation.x = Math.PI / 2;
  group.add(kickFace);
  group.add(cylinder(kit, shell, 0.3, 0.3, -0.75, top + 1.0, -0.8));
  group.add(cylinder(kit, shell, 0.3, 0.3, 0.75, top + 1.0, -0.8));
  const cymbals = [-1.3, 1.3].map((x) => {
    const c = cylinder(kit, brass, 0.45, 0.02, x, top + 1.6, -1.0);
    group.add(c);
    return c;
  });

  const drummer = makeFigure(kit, 0x334155, 0);
  drummer.root.position.set(0, top - 0.35 * FIG, -1.9); // seated behind the kit
  group.add(drummer.root);

  // guitarist and bassist out front
  const players = [
    { x: -3, outfit: 0x111827, bodyColor: 0xdc2626, seed: 2 },
    { x: 3, outfit: 0x7c2d12, bodyColor: 0x1d4ed8, seed: 3 },
  ].map((p) => {
    const f = makeFigure(kit, p.outfit, p.seed);
    f.root.position.set(p.x, DECK_Y, 0.9);
    const guitar = new THREE.Group();
    guitar.add(
      box(
        kit,
        new THREE.MeshStandardMaterial({ color: p.bodyColor, roughness: 0.3 }),
        0.6,
        0.75,
        0.12,
        0,
        0,
        0,
      ),
    );
    guitar.add(box(kit, wood, 0.95, 0.08, 0.06, -0.75, 0.05, 0));
    guitar.position.set(0, 0.35, 0.3);
    guitar.rotation.z = -0.35;
    f.body.add(guitar);
    f.armL.rotation.x = -1.1;
    f.armL.rotation.z = -0.4;
    group.add(f.root);
    const stand = micStand(kit, 1.95 * FIG);
    stand.position.set(p.x, DECK_Y, 1.5);
    group.add(stand);
    return f;
  });

  return (t: number) => {
    const beat = t * 7;
    drummer.armL.rotation.x = -1.0 - Math.max(0, Math.sin(beat)) * 0.8;
    drummer.armR.rotation.x = -1.0 - Math.max(0, Math.sin(beat + Math.PI)) * 0.8;
    drummer.body.rotation.x = Math.sin(beat * 0.5) * 0.05;
    cymbals.forEach((c, i) => (c.rotation.z = Math.sin(beat + i * 2) * 0.12));
    players.forEach((f, i) => {
      f.armR.rotation.x = -0.6 + Math.sin(beat * 1.5 + i) * 0.35; // strumming
      f.body.rotation.x = Math.max(0, Math.sin(t * 3.5 + i)) * 0.18; // head-banging
      f.body.rotation.z = Math.sin(t * 1.2 + i) * 0.06;
    });
  };
}

/** Builds one stage at (x, z), facing the centre of the grove. */
export function buildStage(scene: THREE.Scene, kind: StageKind, x: number, z: number): Stage {
  const kit = createKit();
  const group = new THREE.Group();
  const info = STAGE_INFO[kind];
  const updateShell = buildShell(kit, group, kind);
  const updateCast =
    kind === "singers"
      ? buildSingers(kit, group, info.color)
      : kind === "dancers"
        ? buildDancers(kit, group)
        : buildBand(kit, group);

  group.position.set(x, 0, z);
  group.lookAt(0, 0, 0);
  scene.add(group);

  return {
    kind,
    color: info.color,
    position: new THREE.Vector3(x, 0, z),
    update: (t) => {
      updateShell(t);
      updateCast(t);
    },
  };
}
