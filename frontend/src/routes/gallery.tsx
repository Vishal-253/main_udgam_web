import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import groundImg from "@/assets/ground.jpg";
import mountainImg from "@/assets/distant_mountains_sikkim.jpg";
import "../gallery.css";

export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title: "3D Memory Grove Gallery — Udgam 2K26" },
      {
        name: "description",
        content:
          "Explore the magical 3D world of Udgam — NIT Sikkim's annual cultural festival. Walk through cherry blossom groves surrounded by majestic Himalayan mountains and discover memories from every edition.",
      },
      { property: "og:title", content: "3D Memory Grove — Udgam 2K26" },
      {
        property: "og:description",
        content:
          "Walk through cherry blossom groves surrounded by mountains and discover festival memories from every edition.",
      },
    ],
  }),
  component: GalleryPage,
});

export interface EditionInfo {
  key: string;
  title: string;
  tagline: string;
  url: string;
  folder: string;
  color: string;
  accentColor: string;
  photos: string[];
}

export const UDGAM_EDITIONS: EditionInfo[] = [
  {
    key: "udgam2k25",
    title: "Udgam 2K25",
    tagline: "The dawn of a new era — bigger, bolder, brighter",
    url: "#",
    folder: "images/udgam2k25",
    color: "#f9a8c9",
    accentColor: "#e8547a",
    photos: [],
  },
  {
    key: "udgam2k24",
    title: "Udgam 2K24",
    tagline: "A year of stars, stories and spectacular moments",
    url: "#",
    folder: "images/udgam2k24",
    color: "#ffb347",
    accentColor: "#f07000",
    photos: [],
  },
  {
    key: "udgam2k23",
    title: "Udgam 2K23",
    tagline: "Where art meets ambition — Udgam returns",
    url: "#",
    folder: "images/udgam2k23",
    color: "#a78bfa",
    accentColor: "#7c3aed",
    photos: [],
  },
  {
    key: "udgam2k22",
    title: "Udgam 2K22",
    tagline: "Rising from silence — culture finds its voice again",
    url: "#",
    folder: "images/udgam2k22",
    color: "#34d399",
    accentColor: "#059669",
    photos: [],
  },
  {
    key: "udgam2k21",
    title: "Udgam 2K21",
    tagline: "Digital horizons — festival beyond boundaries",
    url: "#",
    folder: "images/udgam2k21",
    color: "#60a5fa",
    accentColor: "#2563eb",
    photos: [],
  },
  {
    key: "udgam2k20",
    title: "Udgam 2K20",
    tagline: "The last great gathering before the world paused",
    url: "#",
    folder: "images/udgam2k20",
    color: "#f472b6",
    accentColor: "#db2777",
    photos: [],
  },
  {
    key: "udgam2k19",
    title: "Udgam 2K19",
    tagline: "Nights of music, days of magic",
    url: "#",
    folder: "images/udgam2k19",
    color: "#fbbf24",
    accentColor: "#d97706",
    photos: [],
  },
  {
    key: "udgam2k18",
    title: "Udgam 2K18",
    tagline: "Where it all began to glow",
    url: "#",
    folder: "images/udgam2k18",
    color: "#f87171",
    accentColor: "#dc2626",
    photos: [],
  },
];

function buildPhotoList(folder: string, maxN: number) {
  const exts = ["jpg", "jpeg", "png", "webp"];
  const list: string[] = [];
  for (let i = 1; i <= maxN; i++) {
    for (const ext of exts) {
      list.push(`/${folder}/${i}.${ext}`);
    }
  }
  return list;
}

export function GalleryPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const minimapCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Real Loading state
  const [loadingProgress, setLoadingProgress] = useState(15);
  const [loadingStatus, setLoadingStatus] = useState("Preparing Himalayan Grove...");
  const [isLoaded, setIsLoaded] = useState(false);
  const [controlsHintVisible, setControlsHintVisible] = useState(true);

  // Gallery Modal State
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [currentEdition, setCurrentEdition] = useState<EditionInfo | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [photoList, setPhotoList] = useState<string[]>([]);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Proximity cooldown state ref
  const proximityCooldownRef = useRef<{ [key: string]: number }>({});
  const activeEditionRef = useRef<string | null>(null);

  // Joystick controller state
  const joyStateRef = useRef({
    active: false,
    dx: 0,
    dy: 0,
    camRotate: 0,
  });

  const joyStickRef = useRef<HTMLDivElement | null>(null);
  const joyBaseRef = useRef<HTMLDivElement | null>(null);

  // Open modal handler
  const handleOpenGallery = useCallback((editionKey: string) => {
    const edition = UDGAM_EDITIONS.find((e) => e.key === editionKey);
    if (!edition) return;

    activeEditionRef.current = editionKey;
    setCurrentEdition(edition);
    setCurrentPhotoIndex(0);

    const photos = edition.photos.length > 0 ? edition.photos : buildPhotoList(edition.folder, 10);
    setPhotoList(photos);
    setImageLoaded(false);
    setImageError(false);
    setGalleryOpen(true);
  }, []);

  const handleCloseGallery = useCallback(() => {
    if (activeEditionRef.current) {
      proximityCooldownRef.current[activeEditionRef.current] = Date.now() + 2500;
    }
    setGalleryOpen(false);
  }, []);

  const handlePrevPhoto = useCallback(() => {
    if (photoList.length === 0) return;
    setImageLoaded(false);
    setImageError(false);
    setCurrentPhotoIndex((prev) => (prev - 1 + photoList.length) % photoList.length);
  }, [photoList.length]);

  const handleNextPhoto = useCallback(() => {
    if (photoList.length === 0) return;
    setImageLoaded(false);
    setImageError(false);
    setCurrentPhotoIndex((prev) => (prev + 1) % photoList.length);
  }, [photoList.length]);

  // Keyboard navigation for modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!galleryOpen) return;
      if (e.key === "ArrowLeft") handlePrevPhoto();
      if (e.key === "ArrowRight") handleNextPhoto();
      if (e.key === "Escape") handleCloseGallery();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [galleryOpen, handlePrevPhoto, handleNextPhoto, handleCloseGallery]);

  // Touch joystick handlers
  const handleJoyStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    const touch = e.targetTouches ? e.targetTouches[0] : (e as any).touches[0];
    if (!touch || !joyBaseRef.current) return;
    joyStateRef.current.active = true;
    updateJoyPosition(touch.clientX, touch.clientY);
  };

  const handleJoyMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!joyStateRef.current.active) return;
    e.preventDefault();
    const touch = e.targetTouches ? e.targetTouches[0] : (e as any).touches[0];
    if (!touch) return;
    updateJoyPosition(touch.clientX, touch.clientY);
  };

  const handleJoyEnd = () => {
    joyStateRef.current.active = false;
    joyStateRef.current.dx = 0;
    joyStateRef.current.dy = 0;
    if (joyStickRef.current) {
      joyStickRef.current.style.transform = "translate(-50%, -50%)";
    }
  };

  const updateJoyPosition = (cx: number, cy: number) => {
    if (!joyBaseRef.current || !joyStickRef.current) return;
    const rect = joyBaseRef.current.getBoundingClientRect();
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;
    const MAX_DIST = 38;

    let ox = cx - startX;
    let oy = cy - startY;
    const dist = Math.sqrt(ox * ox + oy * oy);
    if (dist > MAX_DIST) {
      ox = (ox / dist) * MAX_DIST;
      oy = (oy / dist) * MAX_DIST;
    }
    joyStateRef.current.dx = ox / MAX_DIST;
    joyStateRef.current.dy = oy / MAX_DIST;
    joyStickRef.current.style.transform = `translate(calc(-50% + ${ox}px), calc(-50% + ${oy}px))`;
  };

  // THREE.JS WORLD ENGINE
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animationFrameId: number;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;

    const scene = new THREE.Scene();
    // Soft, luminous morning sakura mist
    scene.fog = new THREE.FogExp2(0xf5d9e5, 0.0035);

    const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 400);
    camera.position.set(0, 5, 12);

    const clock = new THREE.Clock();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", handleResize);

    // ── LOADING MANAGER ──────────────────────────────────────────
    const loadingManager = new THREE.LoadingManager();
    loadingManager.onProgress = (_item, loaded, total) => {
      const pct = Math.round((loaded / total) * 85);
      setLoadingProgress(Math.max(25, pct));
      if (pct > 50) setLoadingStatus("Setting Up Festival Grounds...");
    };
    loadingManager.onLoad = () => {
      setLoadingProgress(100);
      setLoadingStatus("Welcome to Udgam 3D World!");
      setTimeout(() => {
        setIsLoaded(true);
        setTimeout(() => setControlsHintVisible(false), 5000);
      }, 350);
    };

    const textureLoader = new THREE.TextureLoader(loadingManager);

    // Fallback timer in case textures load from browser cache instantly
    const safetyTimer = setTimeout(() => {
      setLoadingProgress(100);
      setIsLoaded(true);
    }, 1800);

    // ── LIGHTING: Bright, Natural Himalayan Day ──────────────────
    const ambientLight = new THREE.AmbientLight(0xffeff6, 1.0);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x7dc5f5, 0x4d753b, 0.7);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff5e6, 1.5);
    sunLight.position.set(45, 85, 40);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 250;
    sunLight.shadow.camera.left = -80;
    sunLight.shadow.camera.right = 80;
    sunLight.shadow.camera.top = 80;
    sunLight.shadow.camera.bottom = -80;
    sunLight.shadow.bias = -0.0008;
    scene.add(sunLight);

    // Soft sky rim light
    const skyRim = new THREE.DirectionalLight(0xffc5da, 0.5);
    skyRim.position.set(-30, 25, -40);
    scene.add(skyRim);

    // ── SKY DOME: Clear morning blue down to pastel sunrise pink ──
    const skyGeo = new THREE.SphereGeometry(280, 32, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        topColor: { value: new THREE.Color(0x5da6de) },
        midColor: { value: new THREE.Color(0xfac0d5) },
        bottomColor: { value: new THREE.Color(0xffdfcb) },
      },
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 midColor;
        uniform vec3 bottomColor;
        varying vec3 vPos;
        void main() {
          float h = normalize(vPos).y;
          vec3 col = mix(bottomColor, midColor, smoothstep(-0.05, 0.25, h));
          col = mix(col, topColor, smoothstep(0.2, 0.75, h));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(sky);

    // ── MOUNTAIN PANORAMA HORIZON ────────────────────────────────
    const mountainTex = textureLoader.load(mountainImg);
    mountainTex.colorSpace = THREE.SRGBColorSpace;
    mountainTex.wrapS = THREE.RepeatWrapping;
    mountainTex.wrapT = THREE.ClampToEdgeWrapping;
    mountainTex.repeat.set(3, 1);

    const mountainGeo = new THREE.CylinderGeometry(230, 230, 95, 48, 1, true);
    const mountainMat = new THREE.MeshBasicMaterial({
      map: mountainTex,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.94,
      fog: true,
    });
    const mountainMesh = new THREE.Mesh(mountainGeo, mountainMat);
    mountainMesh.position.y = 35;
    scene.add(mountainMesh);

    // ── HOT AIR BALLOON ("UDGAM") IN DISTANT SKY ─────────────────
    const balloonGroup = new THREE.Group();
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 32; i++) {
      const t = i / 32;
      const y = (t - 0.45) * 7.0;
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
    const balloonGeo = new THREE.LatheGeometry(pts, 32);

    const balloonCv = document.createElement("canvas");
    balloonCv.width = 1024;
    balloonCv.height = 512;
    const bctx = balloonCv.getContext("2d");
    if (bctx) {
      const stripes = 16;
      const w = balloonCv.width / stripes;
      for (let i = 0; i < stripes; i++) {
        bctx.fillStyle = i % 2 === 0 ? "#ff6088" : "#fff5f8";
        bctx.fillRect(i * w, 0, w, balloonCv.height);
        bctx.fillStyle = "#f5c842";
        bctx.fillRect(i * w + w - 3, 0, 3, balloonCv.height);
      }
      bctx.fillStyle = "rgba(255, 255, 255, 0.95)";
      bctx.fillRect(0, 190, balloonCv.width, 132);
      bctx.fillStyle = "#f5c842";
      bctx.fillRect(0, 184, balloonCv.width, 6);
      bctx.fillRect(0, 322, balloonCv.width, 6);
      bctx.fillStyle = "#d81b4b";
      bctx.font = "900 82px 'Outfit', sans-serif";
      bctx.textAlign = "center";
      bctx.textBaseline = "middle";
      bctx.fillText("🌸 UDGAM 🌸", balloonCv.width * 0.25, 256);
      bctx.fillText("🌸 UDGAM 🌸", balloonCv.width * 0.75, 256);
    }
    const balloonTex = new THREE.CanvasTexture(balloonCv);
    balloonTex.colorSpace = THREE.SRGBColorSpace;
    const balloonMat = new THREE.MeshStandardMaterial({
      map: balloonTex,
      roughness: 0.6,
      metalness: 0.1,
    });
    const balloonEnvelope = new THREE.Mesh(balloonGeo, balloonMat);
    balloonEnvelope.castShadow = true;
    balloonGroup.add(balloonEnvelope);

    // Basket
    const basketGeo = new THREE.CylinderGeometry(0.7, 0.6, 0.7, 8);
    const basketMat = new THREE.MeshStandardMaterial({ color: 0x5a2d1d, roughness: 0.9 });
    const basket = new THREE.Mesh(basketGeo, basketMat);
    basket.position.y = -4.5;
    balloonGroup.add(basket);

    balloonGroup.position.set(40, 32, -60);
    balloonGroup.scale.set(1.4, 1.4, 1.4);
    scene.add(balloonGroup);

    // ── GROUND: Lush green meadow with cherry petals ─────────────
    const groundTex = textureLoader.load(groundImg);
    groundTex.colorSpace = THREE.SRGBColorSpace;
    groundTex.wrapS = THREE.RepeatWrapping;
    groundTex.wrapT = THREE.RepeatWrapping;
    groundTex.repeat.set(24, 24);

    const groundGeo = new THREE.PlaneGeometry(240, 240, 48, 48);
    const groundMat = new THREE.MeshStandardMaterial({
      map: groundTex,
      roughness: 0.85,
      metalness: 0.05,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Paved stone ring walkway connecting the billboards
    const radius = 26;
    const pathGeo = new THREE.RingGeometry(radius - 2.0, radius + 2.0, 64);
    const pathMat = new THREE.MeshStandardMaterial({
      color: 0xfce4ec,
      roughness: 0.65,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
    const path = new THREE.Mesh(pathGeo, pathMat);
    path.rotation.x = -Math.PI / 2;
    path.position.y = 0.03;
    path.receiveShadow = true;
    scene.add(path);

    // ── PROCEDURAL CHERRY BLOSSOM TREES ──────────────────────────
    const blossomColors = [0xffb7d5, 0xffa0c4, 0xffc4dc, 0xfce4ec, 0xff8fb6, 0xffffff];
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a2418, roughness: 0.9 });

    const addBranch = (
      group: THREE.Group,
      startX: number,
      startY: number,
      startZ: number,
      dx: number,
      dy: number,
      dz: number,
      rad: number,
      len: number
    ) => {
      const dir = new THREE.Vector3(dx, dy, dz).normalize();
      const geo = new THREE.CylinderGeometry(rad * 0.6, rad, len, 6);
      const mesh = new THREE.Mesh(geo, trunkMat);
      mesh.position.set(startX + (dir.x * len) / 2, startY + (dir.y * len) / 2, startZ + (dir.z * len) / 2);
      const up = new THREE.Vector3(0, 1, 0);
      const quaternion = new THREE.Quaternion();
      quaternion.setFromUnitVectors(up, dir);
      mesh.quaternion.copy(quaternion);
      mesh.castShadow = true;
      group.add(mesh);
      return new THREE.Vector3(startX + dir.x * len, startY + dir.y * len, startZ + dir.z * len);
    };

    const addBlossom = (group: THREE.Group, px: number, py: number, pz: number, r: number) => {
      const color = blossomColors[Math.floor(Math.random() * blossomColors.length)];
      const geo = new THREE.SphereGeometry(r, 7, 5);
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.85,
        transparent: true,
        opacity: 0.92,
        emissive: new THREE.Color(color).multiplyScalar(0.12),
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(px, py, pz);
      mesh.castShadow = true;
      group.add(mesh);

      const satCount = 2 + Math.floor(Math.random() * 2);
      for (let s = 0; s < satCount; s++) {
        const a = (s / satCount) * Math.PI * 2 + Math.random();
        const satColor = blossomColors[Math.floor(Math.random() * blossomColors.length)];
        const satGeo = new THREE.SphereGeometry(r * 0.58, 6, 4);
        const satMat = new THREE.MeshStandardMaterial({
          color: satColor,
          roughness: 0.85,
          transparent: true,
          opacity: 0.88,
        });
        const sat = new THREE.Mesh(satGeo, satMat);
        sat.position.set(
          px + Math.cos(a) * r * 0.7,
          py + (Math.random() - 0.25) * r * 0.75,
          pz + Math.sin(a) * r * 0.7
        );
        sat.castShadow = true;
        group.add(sat);
      }
    };

    const buildCherryTree = (x: number, z: number, scale = 1) => {
      const group = new THREE.Group();
      const trunkH = 3.6 * scale;
      const trunkGeo = new THREE.CylinderGeometry(0.12 * scale, 0.3 * scale, trunkH, 7);
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = trunkH / 2;
      trunk.rotation.z = (Math.random() - 0.5) * 0.15;
      trunk.castShadow = true;
      group.add(trunk);

      const crownY = trunkH;
      const branchCount = 4 + Math.floor(Math.random() * 3);
      for (let i = 0; i < branchCount; i++) {
        const a = (i / branchCount) * Math.PI * 2 + Math.random() * 0.35;
        const spread = (0.7 + Math.random() * 0.4) * scale;
        const rise = (0.8 + Math.random() * 0.5) * scale;
        const branchLen = (1.5 + Math.random() * 0.7) * scale;
        const dx = Math.cos(a) * spread;
        const dy = rise;
        const dz = Math.sin(a) * spread;
        const tip = addBranch(group, 0, crownY, 0, dx, dy, dz, 0.08 * scale, branchLen);

        const secCount = 2 + Math.floor(Math.random() * 2);
        for (let j = 0; j < secCount; j++) {
          const sa = a + (j - 1) * 0.6 + Math.random() * 0.3;
          const secSpread = (0.4 + Math.random() * 0.3) * scale;
          const secRise = (0.35 + Math.random() * 0.35) * scale;
          const secLen = (0.75 + Math.random() * 0.4) * scale;
          const secTip = addBranch(
            group,
            tip.x,
            tip.y,
            tip.z,
            Math.cos(sa) * secSpread,
            secRise,
            Math.sin(sa) * secSpread,
            0.045 * scale,
            secLen
          );
          addBlossom(group, secTip.x, secTip.y, secTip.z, (0.38 + Math.random() * 0.2) * scale);
        }
        addBlossom(group, tip.x, tip.y + 0.2 * scale, tip.z, (0.48 + Math.random() * 0.15) * scale);
      }

      for (let k = 0; k < 3; k++) {
        const ca = Math.random() * Math.PI * 2;
        const cr = 0.3 * scale;
        addBlossom(
          group,
          Math.cos(ca) * cr,
          crownY + (1.0 + k * 0.4) * scale,
          Math.sin(ca) * cr,
          (0.55 + Math.random() * 0.2) * scale
        );
      }

      group.position.set(x, 0, z);
      scene.add(group);
      return group;
    };

    const treeSpecs: [number, number, number][] = [
      [22, 2, 0.9],
      [-22, -2, 0.85],
      [2, 22, 0.95],
      [-2, -22, 0.9],
      [18, 18, 0.85],
      [-18, 18, 0.8],
      [18, -18, 0.85],
      [-18, -18, 0.9],
      [14, 6, 0.55],
      [-14, 6, 0.52],
      [14, -6, 0.5],
      [-14, -6, 0.52],
      [6, 14, 0.5],
      [-6, 14, 0.48],
      [6, -14, 0.52],
      [-6, -14, 0.48],
      [36, 12, 0.75],
      [-36, 12, 0.8],
      [36, -12, 0.75],
      [-36, -12, 0.8],
      [12, 36, 0.8],
      [-12, 36, 0.75],
      [12, -36, 0.8],
      [-12, -36, 0.75],
      [52, 0, 1.15],
      [-52, 0, 1.2],
      [0, 52, 1.1],
      [0, -52, 1.25],
      [42, 42, 1.15],
      [-42, 42, 1.2],
      [42, -42, 1.1],
      [-42, -42, 1.15],
    ];

    treeSpecs.forEach(([x, z, s]) => {
      buildCherryTree(x, z, s);
    });

    // ── FALLING 3D SAKURA PETALS ─────────────────────────────────
    const PETAL_COUNT = 220;
    const petalPool: {
      mesh: THREE.Mesh;
      vx: number;
      vy: number;
      vz: number;
      rx: number;
      rz: number;
    }[] = [];
    const petalGeo = new THREE.PlaneGeometry(0.18, 0.12);
    const petalColorPalette = [0xffb7d5, 0xffa0c4, 0xffc4dc, 0xffe0ee, 0xffffff];

    const resetPetal = (mesh: THREE.Mesh) => {
      mesh.position.set(
        (Math.random() - 0.5) * 110,
        9 + Math.random() * 15,
        (Math.random() - 0.5) * 110
      );
      mesh.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      );
    };

    for (let i = 0; i < PETAL_COUNT; i++) {
      const c = petalColorPalette[Math.floor(Math.random() * petalColorPalette.length)];
      const pmat = new THREE.MeshBasicMaterial({
        color: c,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      });
      const petal = new THREE.Mesh(petalGeo, pmat);
      resetPetal(petal);
      scene.add(petal);
      petalPool.push({
        mesh: petal,
        vx: 0.01 + (Math.random() - 0.4) * 0.03,
        vy: -0.025 - Math.random() * 0.035,
        vz: 0.01 + (Math.random() - 0.4) * 0.03,
        rx: Math.random() * 0.06,
        rz: Math.random() * 0.06,
      });
    }

    // ── CLEAR, EYE-LEVEL BILLBOARDS WITH HIGH-CONTRAST TEXT ───────
    interface BillboardItem {
      group: THREE.Group;
      edition: EditionInfo;
      position: THREE.Vector3;
      pointLight: THREE.PointLight;
      baseLightIntensity: number;
      floatOffset: number;
      canvasMesh: THREE.Mesh;
    }

    const billboards: BillboardItem[] = [];
    const clickableObjects: THREE.Object3D[] = [];
    const BILLBOARD_RADIUS = 26; // Brought closer to walkway for immediate visibility!

    // Ultra-sharp 2048x1200 billboard texture
    const createBillboardTexture = (edition: EditionInfo) => {
      const W = 2048,
        H = 1200;
      const cv = document.createElement("canvas");
      cv.width = W;
      cv.height = H;
      const ctx = cv.getContext("2d");
      if (!ctx) return new THREE.CanvasTexture(cv);

      // Deep, rich, high-contrast dark berry card
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, "#12040f");
      grad.addColorStop(0.5, "#24081c");
      grad.addColorStop(1, "#10030c");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Radial color glow centered on the year
      const rg = ctx.createRadialGradient(W / 2, H * 0.58, 30, W / 2, H * 0.58, W * 0.48);
      rg.addColorStop(0, edition.color + "66");
      rg.addColorStop(0.6, edition.color + "18");
      rg.addColorStop(1, "transparent");
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, W, H);

      // Ornate outer glowing border
      ctx.lineWidth = 14;
      ctx.strokeStyle = edition.color;
      ctx.strokeRect(30, 30, W - 60, H - 60);

      // Thin inner gold border
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#f5c842";
      ctx.strokeRect(48, 48, W - 96, H - 96);

      // Top festival header badge
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 44px 'Outfit', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = edition.color;
      ctx.shadowBlur = 18;
      ctx.fillText("NIT SIKKIM • UDGAM FESTIVAL ARCHIVE", W / 2, 130);

      // Gold divider
      const dGrad = ctx.createLinearGradient(W * 0.2, 0, W * 0.8, 0);
      dGrad.addColorStop(0, "transparent");
      dGrad.addColorStop(0.5, "#f5c842");
      dGrad.addColorStop(1, "transparent");
      ctx.strokeStyle = dGrad;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(W * 0.2, 185);
      ctx.lineTo(W * 0.8, 185);
      ctx.stroke();

      // Big crisp "UDGAM"
      ctx.fillStyle = "#ffffff";
      ctx.font = "900 130px 'Outfit', serif";
      ctx.shadowColor = edition.color;
      ctx.shadowBlur = 40;
      ctx.fillText("UDGAM", W / 2, 330);

      // Massive Edition Name (e.g. 2K25) in brilliant theme color
      ctx.fillStyle = edition.color;
      ctx.font = "900 230px 'Outfit', serif";
      ctx.shadowColor = edition.color;
      ctx.shadowBlur = 60;
      ctx.fillText(edition.title.replace("Udgam ", ""), W / 2, 580);

      // Tagline in crisp, readable ivory font
      ctx.fillStyle = "#ffffff";
      ctx.font = "600 48px 'Outfit', sans-serif";
      ctx.shadowBlur = 12;
      ctx.shadowColor = "#000000";
      ctx.fillText(edition.tagline, W / 2, 820);

      // Clickable Call-to-Action Pill at bottom
      const pillY = 980;
      const pillW = 900;
      const pillH = 100;
      const pillX = W / 2 - pillW / 2;

      ctx.fillStyle = edition.accentColor;
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, pillH, 50);
      ctx.fill();

      ctx.lineWidth = 6;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 46px 'Outfit', sans-serif";
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#000000";
      ctx.fillText("✦ WALK NEAR OR CLICK TO VIEW ✦", W / 2, pillY + 54);

      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.anisotropy = 16;
      return tex;
    };

    const buildBillboard = (edition: EditionInfo, angle: number) => {
      const group = new THREE.Group();
      const x = Math.sin(angle) * BILLBOARD_RADIUS;
      const z = Math.cos(angle) * BILLBOARD_RADIUS;

      // Board Dimensions: Width 11.2, Height 6.6
      const BW = 11.2,
        BH = 6.6;
      const boardCenterY = 4.3; // Right at player's eye level!

      // Two dark cedar timber posts
      [-BW / 2 - 0.1, BW / 2 + 0.1].forEach((xOff) => {
        const postGeo = new THREE.CylinderGeometry(0.18, 0.22, 8.5, 8);
        const postMat = new THREE.MeshStandardMaterial({
          color: 0x3d1b12,
          roughness: 0.85,
          metalness: 0.1,
        });
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(xOff, 4.25, 0);
        post.castShadow = true;
        group.add(post);

        // Gold post cap
        const capGeo = new THREE.ConeGeometry(0.28, 0.4, 8);
        const capMat = new THREE.MeshStandardMaterial({
          color: 0xf5c842,
          metalness: 0.8,
          roughness: 0.2,
        });
        const cap = new THREE.Mesh(capGeo, capMat);
        cap.position.set(xOff, 8.6, 0);
        group.add(cap);
      });

      // Back frame
      const boardGeo = new THREE.BoxGeometry(BW, BH, 0.2);
      const boardMat = new THREE.MeshStandardMaterial({
        color: 0x22091c,
        metalness: 0.3,
        roughness: 0.7,
      });
      const board = new THREE.Mesh(boardGeo, boardMat);
      board.position.y = boardCenterY;
      board.castShadow = true;
      group.add(board);

      // Glowing outer rim
      const frameMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(edition.color),
        emissive: new THREE.Color(edition.color),
        emissiveIntensity: 1.8,
        metalness: 0.6,
        roughness: 0.2,
      });

      const topY = boardCenterY + BH / 2 + 0.08;
      const botY = boardCenterY - BH / 2 - 0.08;
      [topY, botY].forEach((y) => {
        const barGeo = new THREE.BoxGeometry(BW + 0.3, 0.16, 0.25);
        const bar = new THREE.Mesh(barGeo, frameMat);
        bar.position.y = y;
        group.add(bar);
      });

      // Billboard Canvas Face
      const tex = createBillboardTexture(edition);
      const canvasMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(BW - 0.2, BH - 0.2),
        new THREE.MeshBasicMaterial({ map: tex, transparent: false })
      );
      canvasMesh.position.set(0, boardCenterY, 0.12);
      group.add(canvasMesh);

      // Associate edition data on mesh for click raycasting
      canvasMesh.userData = { editionKey: edition.key };
      clickableObjects.push(canvasMesh);

      // Spinning Halo Glow Rings
      const rings: THREE.Mesh[] = [];
      [4.2, 3.4].forEach((r, ri) => {
        const ringGeo = new THREE.TorusGeometry(r, 0.06, 8, 48);
        const ringMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(ri === 0 ? edition.color : "#ffffff"),
          transparent: true,
          opacity: 0.35,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.y = boardCenterY;
        ring.rotation.x = ri === 0 ? Math.PI / 2 : 0;
        group.add(ring);
        rings.push(ring);
      });
      group.userData.rings = rings;

      // Direct illumination spotlight pointing right at the billboard face!
      const bannerSpot = new THREE.SpotLight(0xffffff, 2.5);
      bannerSpot.position.set(0, boardCenterY + 4, 6);
      bannerSpot.target = canvasMesh;
      bannerSpot.angle = Math.PI / 3;
      bannerSpot.penumbra = 0.5;
      group.add(bannerSpot);

      // Warm colored point light
      const pointLight = new THREE.PointLight(new THREE.Color(edition.color), 2.2, 35);
      pointLight.position.set(0, boardCenterY, 2.5);
      group.add(pointLight);

      // Hanging lanterns on corners
      [-BW / 2, BW / 2].forEach((xOff) => {
        const lanternGroup = new THREE.Group();
        const lGeo = new THREE.SphereGeometry(0.35, 10, 8);
        const lMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(edition.color),
          emissive: new THREE.Color(edition.color),
          emissiveIntensity: 2.0,
          transparent: true,
          opacity: 0.95,
        });
        const lantern = new THREE.Mesh(lGeo, lMat);
        lanternGroup.add(lantern);

        const strGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.8, 4);
        const strMat = new THREE.MeshBasicMaterial({ color: 0x5a2d1d });
        const str = new THREE.Mesh(strGeo, strMat);
        str.position.y = 0.5;
        lanternGroup.add(str);

        lanternGroup.position.set(xOff, topY + 0.8, 0);
        lanternGroup.userData.isLantern = true;
        group.add(lanternGroup);
      });

      // Position along radius and point squarely at the center
      group.position.set(x, 0, z);
      group.lookAt(0, boardCenterY, 0);
      scene.add(group);

      billboards.push({
        group,
        edition,
        position: new THREE.Vector3(x, 0, z),
        pointLight,
        baseLightIntensity: 2.2,
        floatOffset: Math.random() * Math.PI * 2,
        canvasMesh,
      });
    };

    UDGAM_EDITIONS.forEach((edition, i) => {
      const angle = (i / UDGAM_EDITIONS.length) * Math.PI * 2;
      buildBillboard(edition, angle);
    });

    // ── CENTER MONUMENT ───────────────────────────────────────────
    const buildMonument = () => {
      const baseGeo = new THREE.CylinderGeometry(4, 4.5, 0.5, 32);
      const baseMat = new THREE.MeshStandardMaterial({
        color: 0xfce4ec,
        metalness: 0.2,
        roughness: 0.4,
      });
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.position.y = 0.25;
      base.castShadow = true;
      base.receiveShadow = true;
      scene.add(base);

      const pilGeo = new THREE.CylinderGeometry(0.3, 0.4, 7, 16);
      const pilMat = new THREE.MeshStandardMaterial({
        color: 0xf9a8c9,
        emissive: 0xf9a8c9,
        emissiveIntensity: 0.4,
        metalness: 0.5,
        roughness: 0.2,
      });
      const pillar = new THREE.Mesh(pilGeo, pilMat);
      pillar.position.y = 4;
      pillar.castShadow = true;
      scene.add(pillar);

      const orbGeo = new THREE.SphereGeometry(1.2, 32, 24);
      const orbMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xf9a8c9,
        emissiveIntensity: 2.2,
        transparent: true,
        opacity: 0.9,
        metalness: 0.1,
        roughness: 0.05,
      });
      const orb = new THREE.Mesh(orbGeo, orbMat);
      orb.position.y = 8.5;
      scene.add(orb);

      const haloRings: THREE.Mesh[] = [];
      for (let i = 0; i < 3; i++) {
        const ringGeo = new THREE.TorusGeometry(1.5 + i * 0.5, 0.03, 8, 64);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xf9a8c9,
          transparent: true,
          opacity: 0.5 - i * 0.1,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.y = 8.5;
        ring.rotation.x = (i * Math.PI) / 3;
        scene.add(ring);
        haloRings.push(ring);
      }

      const orbLight = new THREE.PointLight(0xf9a8c9, 2.5, 45);
      orbLight.position.y = 8.5;
      scene.add(orbLight);

      return { orb, orbLight, haloRings };
    };
    const monument = buildMonument();

    // ── PLAYER CHARACTER ──────────────────────────────────────────
    const playerGroup = new THREE.Group();
    scene.add(playerGroup);

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xf5caa2, roughness: 0.7 });
    const shirtMat = new THREE.MeshStandardMaterial({
      color: 0xd6336c,
      roughness: 0.7,
      emissive: 0xd6336c,
      emissiveIntensity: 0.15,
    });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x243b55, roughness: 0.8 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x1f1610, roughness: 0.9 });
    const scarfMat = new THREE.MeshStandardMaterial({
      color: 0xffb7d5,
      roughness: 0.7,
      emissive: 0xffb7d5,
      emissiveIntensity: 0.35,
    });
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 });

    const pm = (
      geo: THREE.BufferGeometry,
      mat: THREE.Material,
      px: number,
      py: number,
      pz: number,
      rx = 0,
      ry = 0,
      rz = 0
    ) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(px, py, pz);
      if (rx || ry || rz) m.rotation.set(rx, ry, rz);
      m.castShadow = true;
      playerGroup.add(m);
      return m;
    };

    // Head, Hair, Neck
    pm(new THREE.BoxGeometry(0.38, 0.4, 0.36), skinMat, 0, 1.62, 0);
    pm(new THREE.BoxGeometry(0.41, 0.12, 0.38), hairMat, 0, 1.87, 0);
    pm(new THREE.BoxGeometry(0.41, 0.28, 0.08), hairMat, 0, 1.72, -0.22);
    pm(new THREE.BoxGeometry(0.07, 0.06, 0.04), new THREE.MeshStandardMaterial({ color: 0x1a0a10 }), -0.1, 1.65, 0.19);
    pm(new THREE.BoxGeometry(0.07, 0.06, 0.04), new THREE.MeshStandardMaterial({ color: 0x1a0a10 }), 0.1, 1.65, 0.19);
    pm(new THREE.CylinderGeometry(0.09, 0.1, 0.12, 8), skinMat, 0, 1.44, 0);

    // Torso, Scarf
    pm(new THREE.BoxGeometry(0.5, 0.55, 0.28), shirtMat, 0, 1.1, 0);
    pm(new THREE.TorusGeometry(0.18, 0.045, 6, 16), scarfMat, 0, 1.42, 0, Math.PI / 2, 0, 0);

    // Arms
    const leftUpperArmGroup = new THREE.Group();
    const rightUpperArmGroup = new THREE.Group();
    leftUpperArmGroup.position.set(-0.32, 1.35, 0);
    rightUpperArmGroup.position.set(0.32, 1.35, 0);
    playerGroup.add(leftUpperArmGroup);
    playerGroup.add(rightUpperArmGroup);

    const upperArmGeo = new THREE.CylinderGeometry(0.07, 0.065, 0.3, 8);
    const leftUpperArm = new THREE.Mesh(upperArmGeo, shirtMat);
    leftUpperArm.position.set(-0.06, -0.15, 0);
    leftUpperArm.castShadow = true;
    leftUpperArmGroup.add(leftUpperArm);

    const rightUpperArm = new THREE.Mesh(upperArmGeo, shirtMat);
    rightUpperArm.position.set(0.06, -0.15, 0);
    rightUpperArm.castShadow = true;
    rightUpperArmGroup.add(rightUpperArm);

    const foreArmGeo = new THREE.CylinderGeometry(0.06, 0.055, 0.28, 8);
    const leftForeArm = new THREE.Mesh(foreArmGeo, skinMat);
    leftForeArm.position.set(-0.06, -0.44, 0);
    leftForeArm.castShadow = true;
    leftUpperArmGroup.add(leftForeArm);

    const rightForeArm = new THREE.Mesh(foreArmGeo, skinMat);
    rightForeArm.position.set(0.06, -0.44, 0);
    rightForeArm.castShadow = true;
    rightUpperArmGroup.add(rightForeArm);

    const handGeo = new THREE.SphereGeometry(0.07, 8, 6);
    const lHand = new THREE.Mesh(handGeo, skinMat);
    lHand.position.set(-0.06, -0.6, 0);
    leftUpperArmGroup.add(lHand);
    const rHand = new THREE.Mesh(handGeo, skinMat);
    rHand.position.set(0.06, -0.6, 0);
    rightUpperArmGroup.add(rHand);

    // Legs
    pm(new THREE.BoxGeometry(0.44, 0.18, 0.26), pantsMat, 0, 0.82, 0);
    const leftLegGroup = new THREE.Group();
    const rightLegGroup = new THREE.Group();
    leftLegGroup.position.set(-0.13, 0.78, 0);
    rightLegGroup.position.set(0.13, 0.78, 0);
    playerGroup.add(leftLegGroup);
    playerGroup.add(rightLegGroup);

    const thighGeo = new THREE.CylinderGeometry(0.1, 0.09, 0.35, 8);
    const shinGeo = new THREE.CylinderGeometry(0.08, 0.07, 0.35, 8);
    const shoeGeo = new THREE.BoxGeometry(0.13, 0.1, 0.22);

    [leftLegGroup, rightLegGroup].forEach((lg) => {
      const thigh = new THREE.Mesh(thighGeo, pantsMat);
      thigh.position.y = -0.175;
      thigh.castShadow = true;
      lg.add(thigh);

      const shin = new THREE.Mesh(shinGeo, pantsMat);
      shin.position.y = -0.53;
      shin.castShadow = true;
      lg.add(shin);

      const shoe = new THREE.Mesh(shoeGeo, shoeMat);
      shoe.position.set(0, -0.76, 0.04);
      shoe.castShadow = true;
      lg.add(shoe);
    });

    const shadowGeo = new THREE.CircleGeometry(0.45, 32);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 });
    const shadowCircle = new THREE.Mesh(shadowGeo, shadowMat);
    shadowCircle.rotation.x = -Math.PI / 2;
    shadowCircle.position.y = -0.82;
    playerGroup.add(shadowCircle);

    playerGroup.position.set(0, 0.82, 10);

    // ── CONTROLS & CAMERA ─────────────────────────────────────────
    const playerState = {
      velocity: new THREE.Vector3(),
      baseSpeed: 0.26,
      sprintMultiplier: 1.6,
      yaw: 0,
    };
    const WORLD_HALF = 80;

    const camState = {
      yaw: 0,
      pitch: 0.35,
      distance: 11,
      targetYaw: 0,
      targetPitch: 0.35,
      minPitch: 0.05,
      maxPitch: 1.15,
      minDist: 5,
      maxDist: 26,
    };

    // Smooth Mouse Drag Orbit
    let isDragging = false;
    let didDrag = false;
    let lastMX = 0,
      lastMY = 0;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0 || e.button === 2) {
        isDragging = true;
        didDrag = false;
        lastMX = e.clientX;
        lastMY = e.clientY;
      }
    };
    const onMouseUp = () => {
      isDragging = false;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - lastMX;
      const dy = e.clientY - lastMY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag = true;
      camState.targetYaw -= dx * 0.006;
      camState.targetPitch += dy * 0.006;
      camState.targetPitch = Math.max(camState.minPitch, Math.min(camState.maxPitch, camState.targetPitch));
      lastMX = e.clientX;
      lastMY = e.clientY;
    };
    const onWheel = (e: WheelEvent) => {
      camState.distance = Math.max(
        camState.minDist,
        Math.min(camState.maxDist, camState.distance + e.deltaY * 0.015)
      );
    };

    // Direct Raycast Click to Open Billboard
    const raycaster = new THREE.Raycaster();
    const mouseCoord = new THREE.Vector2();

    const onCanvasClick = (e: MouseEvent) => {
      if (didDrag) return; // Don't trigger if user was dragging camera
      const rect = canvas.getBoundingClientRect();
      mouseCoord.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseCoord.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouseCoord, camera);
      const intersects = raycaster.intersectObjects(clickableObjects, false);
      if (intersects.length > 0) {
        const hit = intersects[0].object;
        if (hit.userData && hit.userData.editionKey) {
          handleOpenGallery(hit.userData.editionKey);
        }
      }
    };

    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("wheel", onWheel, { passive: true });
    canvas.addEventListener("click", onCanvasClick);

    // Touch pinch zoom
    let lastTouchDist = 0;
    const onTouchStart = (e: TouchEvent) => {
      if (e.targetTouches.length === 2) {
        const t0 = e.targetTouches[0],
          t1 = e.targetTouches[1];
        lastTouchDist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.targetTouches.length === 2) {
        const t0 = e.targetTouches[0],
          t1 = e.targetTouches[1];
        const dist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
        camState.distance = Math.max(
          camState.minDist,
          Math.min(camState.maxDist, camState.distance - (dist - lastTouchDist) * 0.05)
        );
        lastTouchDist = dist;
      }
    };
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchmove", onTouchMove, { passive: true });

    // Keyboard keys
    const keys: { [key: string]: boolean } = {};
    const onKeyDown = (e: KeyboardEvent) => {
      keys[e.code] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // Minimap
    const drawMinimap = () => {
      const mmCanvas = minimapCanvasRef.current;
      if (!mmCanvas) return;
      const mmCtx = mmCanvas.getContext("2d");
      if (!mmCtx) return;

      const W = mmCanvas.width,
        H = mmCanvas.height;
      const SCALE = W / 100;
      const cx = W / 2,
        cy = H / 2;

      mmCtx.clearRect(0, 0, W, H);

      // Background
      mmCtx.fillStyle = "rgba(40, 14, 30, 0.92)";
      mmCtx.beginPath();
      mmCtx.arc(cx, cy, W / 2 - 1, 0, Math.PI * 2);
      mmCtx.fill();

      // Border
      mmCtx.strokeStyle = "rgba(255, 182, 206, 0.6)";
      mmCtx.lineWidth = 1.5;
      mmCtx.beginPath();
      mmCtx.arc(cx, cy, W / 2 - 1, 0, Math.PI * 2);
      mmCtx.stroke();

      // Walkway path
      mmCtx.strokeStyle = "rgba(255, 200, 220, 0.45)";
      mmCtx.lineWidth = 1.2;
      mmCtx.beginPath();
      mmCtx.arc(cx, cy, BILLBOARD_RADIUS * SCALE, 0, Math.PI * 2);
      mmCtx.stroke();

      // Billboards
      billboards.forEach((b) => {
        const bx = cx + b.position.x * SCALE;
        const bz = cy + b.position.z * SCALE;
        mmCtx.fillStyle = b.edition.color;
        mmCtx.beginPath();
        mmCtx.arc(bx, bz, 3.8, 0, Math.PI * 2);
        mmCtx.fill();
      });

      // Monument
      mmCtx.fillStyle = "#ffffff";
      mmCtx.beginPath();
      mmCtx.arc(cx, cy, 3, 0, Math.PI * 2);
      mmCtx.fill();

      // Player
      const px = cx + playerGroup.position.x * SCALE;
      const pz = cy + playerGroup.position.z * SCALE;
      mmCtx.fillStyle = "#ff2a6d";
      mmCtx.beginPath();
      mmCtx.arc(px, pz, 4.5, 0, Math.PI * 2);
      mmCtx.fill();
      mmCtx.strokeStyle = "#ffffff";
      mmCtx.lineWidth = 1.5;
      mmCtx.stroke();
    };

    // Proximity
    const TRIGGER_DIST = 6.5;
    const PULSE_DIST = 11;

    const checkProximity = () => {
      const now = Date.now();
      let closest: BillboardItem | null = null;
      let closestDist = Infinity;

      billboards.forEach((b) => {
        const dx = playerGroup.position.x - b.position.x;
        const dz = playerGroup.position.z - b.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < PULSE_DIST) {
          b.pointLight.intensity = b.baseLightIntensity + Math.sin(now * 0.006) * 0.5;
        } else {
          b.pointLight.intensity = b.baseLightIntensity;
        }

        if (dist < TRIGGER_DIST && dist < closestDist) {
          closestDist = dist;
          closest = b;
        }
      });

      if (closest) {
        const cooldown = proximityCooldownRef.current[closest.edition.key] || 0;
        if (now > cooldown && activeEditionRef.current !== closest.edition.key) {
          handleOpenGallery(closest.edition.key);
        }
      } else {
        if (activeEditionRef.current && !galleryOpen) {
          activeEditionRef.current = null;
        }
      }
    };

    // Animation Loop
    const camOffset = new THREE.Vector3();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.getElapsedTime();

      // Player Movement
      if (!galleryOpen) {
        let moveX = 0,
          moveZ = 0;

        const forward = keys["ArrowUp"] || keys["KeyW"];
        const backward = keys["ArrowDown"] || keys["KeyS"];
        const strafeL = keys["ArrowLeft"] || keys["KeyA"];
        const strafeR = keys["ArrowRight"] || keys["KeyD"];
        const isSprinting = keys["ShiftLeft"] || keys["ShiftRight"];

        if (keys["KeyQ"]) camState.targetYaw += 0.04;
        if (keys["KeyE"]) camState.targetYaw -= 0.04;

        if (forward) moveZ -= 1;
        if (backward) moveZ += 1;
        if (strafeL) moveX -= 1;
        if (strafeR) moveX += 1;

        const joy = joyStateRef.current;
        if (joy.active) {
          moveX += joy.dx;
          moveZ += joy.dy;
        }
        camState.targetYaw -= joy.camRotate * 0.045;

        const currentSpeed =
          playerState.baseSpeed * (isSprinting ? playerState.sprintMultiplier : 1.0);

        const moveLen = Math.sqrt(moveX * moveX + moveZ * moveZ);
        if (moveLen > 0) {
          moveX /= moveLen;
          moveZ /= moveLen;

          const camYaw = camState.yaw;
          const relX = moveX * Math.cos(camYaw) - moveZ * Math.sin(camYaw);
          const relZ = moveX * Math.sin(camYaw) + moveZ * Math.cos(camYaw);

          playerState.velocity.x = relX * currentSpeed * 60;
          playerState.velocity.z = relZ * currentSpeed * 60;
          playerState.yaw = Math.atan2(relX, relZ);
        } else {
          playerState.velocity.x *= 0.78;
          playerState.velocity.z *= 0.78;
          playerState.yaw = camState.yaw + Math.PI;
        }

        playerGroup.position.x += playerState.velocity.x * dt;
        playerGroup.position.z += playerState.velocity.z * dt;

        playerGroup.position.x = Math.max(-WORLD_HALF, Math.min(WORLD_HALF, playerGroup.position.x));
        playerGroup.position.z = Math.max(-WORLD_HALF, Math.min(WORLD_HALF, playerGroup.position.z));
      }

      // Walking Animations
      const velMag = Math.hypot(playerState.velocity.x, playerState.velocity.z);
      const isMoving = velMag > 0.4;
      const walkSpeed = isMoving ? 8.5 : 2.0;
      const walkAmp = isMoving ? 0.48 : 0;
      const idleAmp = isMoving ? 0 : 0.03;

      playerGroup.position.y = 0.82 + Math.abs(Math.sin(t * walkSpeed)) * (isMoving ? 0.06 : 0.01);
      leftUpperArmGroup.rotation.x = Math.sin(t * walkSpeed) * walkAmp + Math.sin(t * 1.2) * idleAmp;
      rightUpperArmGroup.rotation.x = -Math.sin(t * walkSpeed) * walkAmp + Math.sin(t * 1.2) * idleAmp;
      leftLegGroup.rotation.x = -Math.sin(t * walkSpeed) * walkAmp;
      rightLegGroup.rotation.x = Math.sin(t * walkSpeed) * walkAmp;

      // Smooth Character Facing
      {
        const targetBodyYaw = playerState.yaw;
        const curYaw = playerGroup.rotation.y;
        let delta = targetBodyYaw - curYaw;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        playerGroup.rotation.y += delta * (isMoving ? 0.22 : 0.14);
      }

      // Camera Follow
      camState.yaw += (camState.targetYaw - camState.yaw) * 0.09;
      camState.pitch += (camState.targetPitch - camState.pitch) * 0.09;

      const cd = camState.distance;
      const cp = camState.pitch;
      const cy = camState.yaw;

      camOffset.set(
        Math.sin(cy) * Math.cos(cp) * cd,
        Math.sin(cp) * cd,
        Math.cos(cy) * Math.cos(cp) * cd
      );

      camera.position.lerp(playerGroup.position.clone().add(camOffset), 0.12);
      camera.lookAt(playerGroup.position.x, playerGroup.position.y + 0.6, playerGroup.position.z);

      // Monument animations
      monument.orb.position.y = 8.5 + Math.sin(t * 1.2) * 0.3;
      monument.orbLight.intensity = 2.0 + Math.sin(t * 2) * 0.5;
      monument.haloRings.forEach((hr, i) => {
        hr.rotation.y = t * (0.4 + i * 0.1);
        hr.rotation.z = t * (0.2 + i * 0.1);
      });

      // Hot Air Balloon Bobbing
      balloonGroup.position.y = 32 + Math.sin(t * 0.6) * 1.8;
      balloonGroup.rotation.y = t * 0.05;

      // Billboards animation
      billboards.forEach((b) => {
        const floatY = Math.sin(t * 0.9 + b.floatOffset) * 0.15;
        b.group.position.y = floatY;

        if (b.group.userData.rings) {
          b.group.userData.rings[0].rotation.y = t * 0.6;
          b.group.userData.rings[1].rotation.z = t * 0.8;
        }

        b.group.children.forEach((child) => {
          if (child.userData && child.userData.isLantern) {
            child.position.y += Math.sin(t * 1.5 + b.floatOffset) * 0.003;
          }
        });
      });

      // Falling Petals
      petalPool.forEach((p) => {
        p.mesh.position.x += p.vx + Math.sin(t * 0.5 + p.vx * 100) * 0.01;
        p.mesh.position.y += p.vy;
        p.mesh.position.z += p.vz;
        p.mesh.rotation.x += p.rx;
        p.mesh.rotation.z += p.rz;

        if (p.mesh.position.y < -0.5) {
          resetPetal(p.mesh);
        }
      });

      checkProximity();
      drawMinimap();
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      clearTimeout(safetyTimer);
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("click", onCanvasClick);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      renderer.dispose();
    };
  }, [handleOpenGallery, galleryOpen]);

  return (
    <div className="gallery-world-wrapper">
      {/* 3D WebGL Canvas */}
      <canvas id="world-canvas" ref={canvasRef} />

      {/* Loading Screen: Interactive Progress & Petals */}
      <div id="loading-screen" className={isLoaded ? "fade-out" : ""}>
        <div className="loading-content">
          <div className="loading-logo">
            <span className="logo-u">U</span>
            <span className="logo-rest">DGAM</span>
          </div>
          <div className="loading-subtitle">NIT SIKKIM Cultural Festival</div>
          <div className="loading-bar-wrap">
            <div className="loading-bar" style={{ width: `${loadingProgress}%` }} />
          </div>
          <div className="loading-percentage">{loadingProgress}%</div>
          <div className="loading-tip">{loadingStatus}</div>
        </div>
        <div className="petal-shower">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="petal"
              style={{
                left: `${(i * 13) % 100}%`,
                top: `${-10 - (i % 20)}%`,
                animationDuration: `${3.5 + (i % 5)}s`,
                animationDelay: `${(i * 0.25) % 3}s`,
                background: i % 2 === 0 ? "#f9a8c9" : "#ffb7d0",
              }}
            />
          ))}
        </div>
      </div>

      {/* HUD: Controls Hint */}
      <div id="controls-hint" className={controlsHintVisible ? "" : "hidden"}>
        🌸 WASD / Arrows to move • Hold Shift to sprint • Click banner or walk near to open
      </div>

      {/* Quick Exit Link */}
      <Link to="/" className="exit-button" aria-label="Back to Fest Home">
        <span>←</span>
        <span>Back to Home</span>
      </Link>

      {/* Minimap */}
      <div id="minimap">
        <canvas id="minimap-canvas" ref={minimapCanvasRef} width={120} height={120} />
        <div className="minimap-label">MAP</div>
      </div>

      {/* Mobile Virtual Joystick */}
      <div
        id="joystick-zone"
        onTouchStart={handleJoyStart}
        onTouchMove={handleJoyMove}
        onTouchEnd={handleJoyEnd}
        onTouchCancel={handleJoyEnd}
      >
        <div id="joystick-base" ref={joyBaseRef}>
          <div id="joystick-stick" ref={joyStickRef} />
        </div>
        <div className="joystick-label">MOVE</div>
      </div>

      {/* Mobile Camera Rotation Pad */}
      <div id="camera-pad">
        <button
          className="cam-btn"
          id="cam-left"
          onTouchStart={() => {
            joyStateRef.current.camRotate = -1;
          }}
          onTouchEnd={() => {
            joyStateRef.current.camRotate = 0;
          }}
          onMouseDown={() => {
            joyStateRef.current.camRotate = -1;
          }}
          onMouseUp={() => {
            joyStateRef.current.camRotate = 0;
          }}
          aria-label="Rotate camera left"
        >
          ◀
        </button>
        <button
          className="cam-btn"
          id="cam-right"
          onTouchStart={() => {
            joyStateRef.current.camRotate = 1;
          }}
          onTouchEnd={() => {
            joyStateRef.current.camRotate = 0;
          }}
          onMouseDown={() => {
            joyStateRef.current.camRotate = 1;
          }}
          onMouseUp={() => {
            joyStateRef.current.camRotate = 0;
          }}
          aria-label="Rotate camera right"
        >
          ▶
        </button>
      </div>

      {/* Gallery Overlay Modal */}
      <div id="gallery-overlay" className={galleryOpen ? "visible" : "hidden"}>
        <div id="gallery-backdrop" onClick={handleCloseGallery} />
        {currentEdition && (
          <div
            id="gallery-panel"
            style={{
              borderColor: `${currentEdition.accentColor}77`,
              boxShadow: `0 0 0 1px rgba(255,180,210,0.15), 0 40px 80px rgba(0,0,0,0.7), 0 0 80px ${currentEdition.color}35`,
            }}
          >
            <button id="gallery-close" onClick={handleCloseGallery} aria-label="Close gallery">
              ✕
            </button>
            <div id="gallery-header">
              <div
                id="gallery-title"
                style={{
                  background: `linear-gradient(135deg, #fff5f8 0%, ${currentEdition.color} 50%, #f5c842 100%)`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {currentEdition.title}
              </div>
              <div id="gallery-tagline">{currentEdition.tagline}</div>
            </div>

            <div id="gallery-carousel">
              <button
                id="gallery-prev"
                className="gallery-nav"
                onClick={handlePrevPhoto}
                aria-label="Previous photo"
              >
                ‹
              </button>
              <div id="gallery-img-wrap">
                {!imageError && photoList.length > 0 && (
                  <img
                    id="gallery-img"
                    src={photoList[currentPhotoIndex]}
                    alt={`${currentEdition.title} memory`}
                    className={imageLoaded ? "" : "hidden"}
                    onLoad={() => setImageLoaded(true)}
                    onError={() => {
                      setImageError(true);
                      setImageLoaded(false);
                    }}
                  />
                )}
                {(!imageLoaded || imageError || photoList.length === 0) && (
                  <div id="gallery-img-placeholder">
                    <div className="placeholder-icon">📷</div>
                    <div className="placeholder-text">{currentEdition.title} Memories</div>
                    <div className="placeholder-sub">
                      Cherished memories & vibrant moments from this edition
                    </div>
                  </div>
                )}
              </div>
              <button
                id="gallery-next"
                className="gallery-nav"
                onClick={handleNextPhoto}
                aria-label="Next photo"
              >
                ›
              </button>
            </div>

            <div id="gallery-dots">
              {photoList.slice(0, 10).map((_, idx) => (
                <div
                  key={idx}
                  className={`gallery-dot ${idx === currentPhotoIndex ? "active" : ""}`}
                  onClick={() => {
                    setImageLoaded(false);
                    setImageError(false);
                    setCurrentPhotoIndex(idx);
                  }}
                  style={{
                    backgroundColor: idx === currentPhotoIndex ? currentEdition.color : undefined,
                    boxShadow:
                      idx === currentPhotoIndex ? `0 0 8px ${currentEdition.color}` : undefined,
                  }}
                />
              ))}
            </div>

            <div id="gallery-counter">
              {photoList.length > 0
                ? `${currentPhotoIndex + 1} of ${Math.min(photoList.length, 10)}`
                : ""}
            </div>

            <a
              id="gallery-link"
              href={currentEdition.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: `linear-gradient(135deg, ${currentEdition.accentColor}, ${currentEdition.color})`,
                boxShadow: `0 4px 20px ${currentEdition.accentColor}55`,
              }}
            >
              <span>Visit Festival Archive</span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
