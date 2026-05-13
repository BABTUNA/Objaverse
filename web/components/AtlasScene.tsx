'use client';

import { useEffect, useMemo, useRef, useState, type MutableRefObject, type Ref } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Billboard, Grid, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { AtlasPoint } from '@/lib/api';
import { resolveAssetUrl } from '@/lib/api';

// Minimal shape of the controls instance we actually touch. drei's OrbitControls
// ref is the three-stdlib class; we only need .update() during the intro tween.
type ControlsLike = { update: () => void };

// Cap textured billboards to keep draw calls bounded; the rest render as a
// single InstancedMesh of colored dots so the cloud still looks populated at
// the full 46k scale. See summary for tradeoffs.
const TEXTURED_CAP = 500;
const CLOUD_SCALE = 12;
const INTRO_DURATION_MS = 1200;

// Hoisted so identity is stable across renders; the intro effect snaps the
// camera on first mount and shouldn't refire when AtlasScene re-renders.
const INTRO_START: [number, number, number] = [CLOUD_SCALE * 3.4, CLOUD_SCALE * 2.2, CLOUD_SCALE * 3.4];
const INTRO_END: [number, number, number] = [CLOUD_SCALE * 1.4, CLOUD_SCALE * 0.9, CLOUD_SCALE * 1.4];

type Props = {
  points: AtlasPoint[];
  filter: string;
  onPick: (point: AtlasPoint) => void;
  onHover: (info: { point: AtlasPoint; screen: { x: number; y: number } } | null) => void;
};

type Sampled = {
  textured: AtlasPoint[];
  dust: AtlasPoint[];
};

function sampleTextured(points: AtlasPoint[]): Sampled {
  if (points.length <= TEXTURED_CAP) {
    return { textured: points, dust: [] };
  }
  // Deterministic uniform stride sample so reloads frame the same neighborhood.
  const stride = points.length / TEXTURED_CAP;
  const textured: AtlasPoint[] = [];
  const picked = new Set<number>();
  for (let i = 0; i < TEXTURED_CAP; i++) {
    const idx = Math.floor(i * stride);
    picked.add(idx);
    textured.push(points[idx]);
  }
  const dust: AtlasPoint[] = [];
  for (let i = 0; i < points.length; i++) {
    if (!picked.has(i)) dust.push(points[i]);
  }
  return { textured, dust };
}

export default function AtlasScene({ points, filter, onPick, onHover }: Props) {
  const sampled = useMemo(() => sampleTextured(points), [points]);
  const normalized = filter.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!normalized) return null;
    const set = new Set<string>();
    for (const p of points) {
      if (p.category.toLowerCase().includes(normalized)) set.add(p.uid);
    }
    return set;
  }, [points, normalized]);

  const controlsRef = useRef<ControlsLike | null>(null);

  return (
    <Canvas
      camera={{ position: INTRO_START, fov: 45 }}
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <color attach="background" args={['#08080c']} />
      <fog attach="fog" args={['#0a0a0f', CLOUD_SCALE * 1.2, CLOUD_SCALE * 3.6]} />

      <ambientLight intensity={0.6} />
      <directionalLight position={[8, 12, 6]} intensity={0.5} />

      <FloorGrid />

      <Dust points={sampled.dust} matches={matches} />
      <Billboards
        points={sampled.textured}
        matches={matches}
        onPick={onPick}
        onHover={onHover}
      />

      <CameraIntro from={INTRO_START} to={INTRO_END} controls={controlsRef} />

      <OrbitControls
        ref={controlsRef as unknown as Ref<ControlsLike>}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enablePan={false}
        minDistance={2}
        maxDistance={CLOUD_SCALE * 3}
        rotateSpeed={0.6}
        zoomSpeed={0.8}
      />
    </Canvas>
  );
}

// Eases the camera from a wide establishing shot in toward the framing position
// over ~1.2s on mount. Disengages itself once done so OrbitControls owns the
// camera again.
function CameraIntro({
  from,
  to,
  controls,
}: {
  from: [number, number, number];
  to: [number, number, number];
  controls: MutableRefObject<ControlsLike | null>;
}) {
  const { camera } = useThree();
  const startedAt = useRef<number | null>(null);
  const done = useRef(false);

  // Snap the camera to the start position once; useThree's camera persists
  // across renders so we don't fight subsequent frames.
  useEffect(() => {
    camera.position.set(from[0], from[1], from[2]);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, from]);

  useFrame(() => {
    if (done.current) return;
    if (startedAt.current == null) startedAt.current = performance.now();
    const t = Math.min(1, (performance.now() - startedAt.current) / INTRO_DURATION_MS);
    // ease-out cubic — quick lift-off, gentle landing
    const e = 1 - Math.pow(1 - t, 3);
    camera.position.set(
      from[0] + (to[0] - from[0]) * e,
      from[1] + (to[1] - from[1]) * e,
      from[2] + (to[2] - from[2]) * e,
    );
    camera.lookAt(0, 0, 0);
    controls.current?.update();
    if (t >= 1) done.current = true;
  });

  return null;
}

function FloorGrid() {
  return (
    <Grid
      position={[0, -CLOUD_SCALE * 1.05, 0]}
      args={[CLOUD_SCALE * 6, CLOUD_SCALE * 6]}
      cellSize={CLOUD_SCALE / 8}
      cellThickness={0.4}
      cellColor="#1c1c28"
      sectionSize={CLOUD_SCALE}
      sectionThickness={0.8}
      sectionColor="#ff7a1a"
      fadeDistance={CLOUD_SCALE * 4}
      fadeStrength={1.4}
      infiniteGrid
    />
  );
}

function Dust({ points, matches }: { points: AtlasPoint[]; matches: Set<string> | null }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const baseColors = useMemo(() => {
    const arr: THREE.Color[] = new Array(points.length);
    const c = new THREE.Color();
    for (let i = 0; i < points.length; i++) {
      const hue = hashHue(points[i].category);
      c.setHSL(hue, 0.55, 0.55);
      arr[i] = c.clone();
    }
    return arr;
  }, [points]);

  // Place instances once per point set.
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      dummy.position.set(p.x * CLOUD_SCALE, p.y * CLOUD_SCALE, p.z * CLOUD_SCALE);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [points, dummy]);

  // Premultiply category color by a fade factor so non-matches dim without
  // touching opacity (per-instance opacity isn't free in three).
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const tmp = new THREE.Color();
    for (let i = 0; i < points.length; i++) {
      const fade = matches && !matches.has(points[i].uid) ? 0.12 : 1.0;
      tmp.copy(baseColors[i]).multiplyScalar(fade);
      mesh.setColorAt(i, tmp);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [matches, points, baseColors]);

  if (points.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, points.length]} frustumCulled={false}>
      <sphereGeometry args={[0.07, 6, 6]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

function Billboards({
  points,
  matches,
  onPick,
  onHover,
}: {
  points: AtlasPoint[];
  matches: Set<string> | null;
  onPick: (point: AtlasPoint) => void;
  onHover: (info: { point: AtlasPoint; screen: { x: number; y: number } } | null) => void;
}) {
  return (
    <group>
      {points.map((p) => (
        <ThumbSprite
          key={p.uid}
          point={p}
          dim={matches != null && !matches.has(p.uid)}
          onPick={onPick}
          onHover={onHover}
        />
      ))}
    </group>
  );
}

function ThumbSprite({
  point,
  dim,
  onPick,
  onHover,
}: {
  point: AtlasPoint;
  dim: boolean;
  onPick: (point: AtlasPoint) => void;
  onHover: (info: { point: AtlasPoint; screen: { x: number; y: number } } | null) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(
      resolveAssetUrl(point.thumb_url),
      (tex) => {
        if (cancelled) {
          tex.dispose();
          return;
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 2;
        setTexture(tex);
      },
      undefined,
      () => {
        // Swallow errors — point will render as a tinted plane.
      },
    );
    return () => {
      cancelled = true;
    };
  }, [point.thumb_url]);

  useEffect(() => () => texture?.dispose(), [texture]);

  // Subtle scale animation on hover without re-rendering each frame.
  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const target = hovered ? 1.5 : 1.0;
    mesh.scale.x += (target - mesh.scale.x) * 0.18;
    mesh.scale.y += (target - mesh.scale.y) * 0.18;
    mesh.scale.z += (target - mesh.scale.z) * 0.18;
  });

  const opacity = dim ? 0.1 : 1.0;

  return (
    <Billboard position={[point.x * CLOUD_SCALE, point.y * CLOUD_SCALE, point.z * CLOUD_SCALE]}>
      <mesh
        ref={meshRef}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          setHovered(true);
          onHover({ point, screen: { x: e.clientX, y: e.clientY } });
          document.body.style.cursor = 'pointer';
        }}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => {
          if (hovered) onHover({ point, screen: { x: e.clientX, y: e.clientY } });
        }}
        onPointerOut={() => {
          setHovered(false);
          onHover(null);
          document.body.style.cursor = '';
        }}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          onPick(point);
        }}
      >
        <planeGeometry args={[0.55, 0.55]} />
        <meshBasicMaterial
          map={texture ?? undefined}
          color={texture ? '#ffffff' : '#ff7a1a'}
          transparent
          opacity={opacity}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </Billboard>
  );
}

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  // Keep hues away from pure red so it doesn't clash with the ember accent.
  return ((h % 1000) / 1000 + 0.55) % 1;
}

