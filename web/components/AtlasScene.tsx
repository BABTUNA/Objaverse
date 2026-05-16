'use client';

import { useEffect, useMemo, useRef, type MutableRefObject, type Ref } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Billboard, OrbitControls, Sphere, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { AtlasPoint } from '@/lib/api';

// Minimal shape of the controls instance we actually touch. drei's OrbitControls
// ref is the three-stdlib class; we only need .update() during the intro tween.
type ControlsLike = { update: () => void };

const CLOUD_SCALE = 12;
const INTRO_DURATION_MS = 1200;

// Hoisted so identity is stable across renders; the intro effect snaps the
// camera on first mount and shouldn't refire when AtlasScene re-renders.
const INTRO_START: [number, number, number] = [CLOUD_SCALE * 3.4, CLOUD_SCALE * 2.2, CLOUD_SCALE * 3.4];
const INTRO_END: [number, number, number] = [CLOUD_SCALE * 1.4, CLOUD_SCALE * 0.9, CLOUD_SCALE * 1.4];

// Marker color palette — deeper amber against the warm paper background
// for legibility, emerald for hover/select, soft tan for the dimmed state
// (close to the canvas so non-matches fade into the page rather than
// reading as dark blobs the way pure black would on cream).
const COLOR_DEFAULT = new THREE.Color('#d97706');
const COLOR_DIM = new THREE.Color('#d6cba0');
const COLOR_HOVER = new THREE.Color('#059669');
const COLOR_SELECT = new THREE.Color('#059669');

type Props = {
  points: AtlasPoint[];
  filter: string;
  lockedCategories: Set<string>;
  selectedUid: string | null;
  onPick: (point: AtlasPoint) => void;
  onHover: (info: { point: AtlasPoint; screen: { x: number; y: number } } | null) => void;
};

export default function AtlasScene({
  points,
  filter,
  lockedCategories,
  selectedUid,
  onPick,
  onHover,
}: Props) {
  const normalized = filter.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!normalized && lockedCategories.size === 0) return null;
    const set = new Set<string>();
    for (const p of points) {
      const cat = p.category.toLowerCase();
      const passSubstring = !normalized || cat.includes(normalized);
      const passLocked = lockedCategories.size === 0 || lockedCategories.has(p.category);
      if (passSubstring && passLocked) set.add(p.uid);
    }
    return set;
  }, [points, normalized, lockedCategories]);

  const controlsRef = useRef<ControlsLike | null>(null);

  return (
    <Canvas
      camera={{ position: INTRO_START, fov: 45 }}
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <color attach="background" args={['#f2ede2']} />
      <fog attach="fog" args={['#faf7f1', CLOUD_SCALE * 1.4, CLOUD_SCALE * 4.0]} />

      <ambientLight intensity={0.8} />
      <directionalLight position={[8, 12, 6]} intensity={0.4} />

      <GlobeShell />
      <Reticle />

      <Markers
        points={points}
        matches={matches}
        selectedUid={selectedUid}
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

// Faint wireframe sphere wrapping the cloud — evokes the globe in the reference
// without distorting the embedding (it's purely decorative).
function GlobeShell() {
  return (
    <>
      <Sphere args={[CLOUD_SCALE * 1.05, 32, 24]}>
        <meshBasicMaterial color="#aea58e" wireframe transparent opacity={0.25} depthWrite={false} />
      </Sphere>
      <Sphere args={[CLOUD_SCALE * 1.04, 64, 1]}>
        <meshBasicMaterial color="#34d399" wireframe transparent opacity={0.06} depthWrite={false} />
      </Sphere>
    </>
  );
}

// Subtle equatorial / polar rings so the scene reads as a globe at a glance.
function Reticle() {
  const ringRef = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ringRef.current) ringRef.current.rotation.y += dt * 0.02;
  });
  return (
    <group ref={ringRef}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[CLOUD_SCALE * 1.05, CLOUD_SCALE * 1.06, 96]} />
        <meshBasicMaterial color="#facc15" transparent opacity={0.08} side={THREE.DoubleSide} />
      </mesh>
      <mesh>
        <ringGeometry args={[CLOUD_SCALE * 1.05, CLOUD_SCALE * 1.055, 96]} />
        <meshBasicMaterial color="#34d399" transparent opacity={0.06} side={THREE.DoubleSide} />
      </mesh>
    </group>
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

  useEffect(() => {
    camera.position.set(from[0], from[1], from[2]);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, from]);

  useFrame(() => {
    if (done.current) return;
    if (startedAt.current == null) startedAt.current = performance.now();
    const t = Math.min(1, (performance.now() - startedAt.current) / INTRO_DURATION_MS);
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

// Single InstancedMesh covers all 46k points. Hover/select are tracked by index
// in refs so the per-frame loop can interpolate scale/color without React
// re-renders. Picking uses three's intersectObject on the instanced mesh.
function Markers({
  points,
  matches,
  selectedUid,
  onPick,
  onHover,
}: {
  points: AtlasPoint[];
  matches: Set<string> | null;
  selectedUid: string | null;
  onPick: (point: AtlasPoint) => void;
  onHover: (info: { point: AtlasPoint; screen: { x: number; y: number } } | null) => void;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmpColor = useMemo(() => new THREE.Color(), []);

  // Stable index → uid lookup so the click handler can map back to a point.
  const uidByIndex = useMemo(() => points.map((p) => p.uid), [points]);
  const indexByUid = useMemo(() => {
    const m = new Map<string, number>();
    points.forEach((p, i) => m.set(p.uid, i));
    return m;
  }, [points]);

  // Hovered/selected indices live in refs so the per-frame loop drives them
  // without re-rendering the React tree on every cursor move. We also track
  // the *previous* hovered index so the decay sweep is O(1) instead of O(n).
  const hoveredIdx = useRef<number>(-1);
  const prevHoveredIdx = useRef<number>(-1);
  const animScale = useRef<Float32Array>(new Float32Array(0));

  useEffect(() => {
    animScale.current = new Float32Array(points.length);
  }, [points.length]);

  // Place all instances once per point set.
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

  // Re-paint instance colors on filter / selection change. Hover color is
  // applied per-frame because it changes faster than React would tick.
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const selectedIdx = selectedUid ? indexByUid.get(selectedUid) ?? -1 : -1;
    for (let i = 0; i < points.length; i++) {
      const inMatch = matches ? matches.has(points[i].uid) : true;
      const isSelected = i === selectedIdx;
      if (isSelected) tmpColor.copy(COLOR_SELECT);
      else if (!inMatch) tmpColor.copy(COLOR_DIM);
      else tmpColor.copy(COLOR_DEFAULT);
      mesh.setColorAt(i, tmpColor);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [matches, points, selectedUid, indexByUid, tmpColor]);

  // Per-frame: ease the hovered + selected scales toward their targets, decay
  // the previously-hovered marker back to 1, restore its color. Strict O(1)
  // per frame regardless of point count.
  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const selectedIdx = selectedUid ? indexByUid.get(selectedUid) ?? -1 : -1;
    let dirty = false;
    let colorDirty = false;

    const writeInstance = (idx: number, scale: number, color: THREE.Color) => {
      const p = points[idx];
      dummy.position.set(p.x * CLOUD_SCALE, p.y * CLOUD_SCALE, p.z * CLOUD_SCALE);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(idx, dummy.matrix);
      mesh.setColorAt(idx, color);
    };

    // Hovered marker — pulse to 2.6x and tint hover green.
    if (hoveredIdx.current >= 0 && hoveredIdx.current < points.length) {
      const idx = hoveredIdx.current;
      const cur = animScale.current[idx] || 1;
      const next = cur + (2.6 - cur) * 0.22;
      animScale.current[idx] = next;
      writeInstance(idx, next, COLOR_HOVER);
      dirty = true;
      colorDirty = true;
    }

    // Selected marker (when distinct from hovered) — sit at 2x, also green.
    if (selectedIdx >= 0 && selectedIdx !== hoveredIdx.current) {
      const cur = animScale.current[selectedIdx] || 1;
      const next = cur + (2.0 - cur) * 0.22;
      animScale.current[selectedIdx] = next;
      writeInstance(selectedIdx, next, COLOR_SELECT);
      dirty = true;
      colorDirty = true;
    }

    // Decay the previously-hovered marker if it's no longer hovered/selected.
    const prev = prevHoveredIdx.current;
    if (
      prev >= 0 &&
      prev < points.length &&
      prev !== hoveredIdx.current &&
      prev !== selectedIdx
    ) {
      const cur = animScale.current[prev] || 1;
      const next = cur + (1 - cur) * 0.22;
      animScale.current[prev] = Math.abs(next - 1) < 0.01 ? 1 : next;
      const p = points[prev];
      const inMatch = matches ? matches.has(p.uid) : true;
      tmpColor.copy(inMatch ? COLOR_DEFAULT : COLOR_DIM);
      writeInstance(prev, animScale.current[prev], tmpColor);
      dirty = true;
      colorDirty = true;
      if (animScale.current[prev] === 1) prevHoveredIdx.current = -1;
    }

    // Track current hover for next frame's decay step.
    if (hoveredIdx.current >= 0) prevHoveredIdx.current = hoveredIdx.current;

    if (dirty) mesh.instanceMatrix.needsUpdate = true;
    if (colorDirty && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  if (points.length === 0) return null;

  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, points.length]}
        frustumCulled={false}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => {
          if (e.instanceId == null) return;
          e.stopPropagation();
          if (hoveredIdx.current !== e.instanceId) {
            // Snapshot the outgoing index so the per-frame decay sweeps it back to 1.
            if (hoveredIdx.current >= 0) prevHoveredIdx.current = hoveredIdx.current;
            hoveredIdx.current = e.instanceId;
          }
          const uid = uidByIndex[e.instanceId];
          const p = points[e.instanceId];
          if (uid && p) {
            onHover({ point: p, screen: { x: e.clientX, y: e.clientY } });
            document.body.style.cursor = 'pointer';
          }
        }}
        onPointerOut={() => {
          if (hoveredIdx.current >= 0) prevHoveredIdx.current = hoveredIdx.current;
          hoveredIdx.current = -1;
          onHover(null);
          document.body.style.cursor = '';
        }}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          if (e.instanceId == null) return;
          e.stopPropagation();
          const p = points[e.instanceId];
          if (p) onPick(p);
        }}
      >
        <sphereGeometry args={[0.085, 8, 8]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      {/* Persistent halo around the selected marker so it stays legible when
          another marker is hovered in green. */}
      {selectedUid && (() => {
        const idx = indexByUid.get(selectedUid);
        if (idx == null) return null;
        const p = points[idx];
        return (
          <group position={[p.x * CLOUD_SCALE, p.y * CLOUD_SCALE, p.z * CLOUD_SCALE]}>
            <SelectionRing />
          </group>
        );
      })()}

      <MarkerLabels points={points} matches={matches} selectedUid={selectedUid} />
    </>
  );
}

// Always-visible category labels next to each marker. Billboarded so they
// stay legible regardless of camera angle. Capped at LABEL_CAP to keep
// troika-text mesh count bounded at large N — once the cloud grows past
// the cap we'd want to fall back to category centroid labels instead.
const LABEL_CAP = 250;

function MarkerLabels({
  points,
  matches,
  selectedUid,
}: {
  points: AtlasPoint[];
  matches: Set<string> | null;
  selectedUid: string | null;
}) {
  const visible = points.length <= LABEL_CAP ? points : points.slice(0, LABEL_CAP);
  return (
    <group>
      {visible.map((p) => {
        const inMatch = matches ? matches.has(p.uid) : true;
        const isSelected = p.uid === selectedUid;
        const color = isSelected ? '#059669' : inMatch ? '#2a2620' : '#cfc6b1';
        const opacity = inMatch ? 1 : 0.5;
        const fontSize = isSelected ? 0.22 : 0.15;
        return (
          <Billboard
            key={p.uid}
            position={[
              p.x * CLOUD_SCALE,
              p.y * CLOUD_SCALE + 0.32,
              p.z * CLOUD_SCALE,
            ]}
          >
            <Text
              fontSize={fontSize}
              color={color}
              anchorX="center"
              anchorY="bottom"
              outlineWidth={0.012}
              outlineColor="#faf7f1"
              outlineOpacity={0.95}
              fillOpacity={opacity}
              maxWidth={3.5}
              overflowWrap="break-word"
            >
              {p.category}
            </Text>
          </Billboard>
        );
      })}
    </group>
  );
}

function SelectionRing() {
  const ringRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ringRef.current) return;
    const t = clock.getElapsedTime();
    const s = 1 + Math.sin(t * 3) * 0.08;
    ringRef.current.scale.setScalar(s);
    // Always face the camera by leaving rotation for Billboard-equivalent — we
    // skip Billboard here so the ring tilts with the cloud, which reads as
    // tagged-in-3d-space.
  });
  return (
    <mesh ref={ringRef}>
      <ringGeometry args={[0.32, 0.4, 32]} />
      <meshBasicMaterial color="#34d399" transparent opacity={0.85} side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
  );
}
