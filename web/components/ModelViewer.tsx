'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, OrbitControls, useGLTF, Bounds, useBounds } from '@react-three/drei';
import * as THREE from 'three';
import type { Hit } from '@/lib/api';
import { resolveAssetUrl } from '@/lib/api';

type Props = {
  hit: Hit | null;
  onClose: () => void;
};

export default function ModelViewer({ hit, onClose }: Props) {
  const [autoRotate, setAutoRotate] = useState(true);

  useEffect(() => {
    if (!hit) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [hit, onClose]);

  if (!hit) return null;
  const scorePct = Math.round(hit.score * 100);
  const glbUrl = resolveAssetUrl(hit.glb_url);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`3D viewer for ${hit.category}`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10 animate-fade-in"
    >
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink-950/80 backdrop-blur-md cursor-default"
      />
      <div className="relative flex h-full max-h-[860px] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-ink-700 bg-ink-900/95 shadow-2xl animate-rise-in">
        <header className="flex flex-wrap items-center gap-3 border-b border-ink-700/80 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-ember-500 animate-pulse-slow" />
            <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-ink-300">
              {hit.category || 'untagged'}
            </span>
          </div>
          <div className="hidden md:block h-4 w-px bg-ink-700" />
          <span className="font-mono text-[11px] text-ink-400 truncate" title={hit.uid}>
            uid · {hit.uid}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Badge label="similarity" value={`${scorePct}%`} />
            <Badge label="distance" value={(1 - hit.score).toFixed(4)} mono />
            <button
              onClick={() => setAutoRotate((v) => !v)}
              className="rounded-md border border-ink-700 px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider text-ink-200 hover:border-ember-500/60 hover:text-ember-400 transition-colors"
            >
              {autoRotate ? 'pause' : 'rotate'}
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-md border border-ink-700 p-1.5 text-ink-300 hover:border-ember-500/60 hover:text-ember-400 transition-colors"
            >
              <CloseIcon />
            </button>
          </div>
        </header>

        <div className="relative flex-1 min-h-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,#15151f_0%,#08080c_100%)]">
          <Canvas
            camera={{ position: [2.4, 1.6, 2.6], fov: 38 }}
            dpr={[1, 2]}
            gl={{ antialias: true, preserveDrawingBuffer: false }}
          >
            <color attach="background" args={['#0a0a0f']} />
            <ambientLight intensity={0.35} />
            <directionalLight position={[4, 6, 3]} intensity={0.8} />
            <Suspense fallback={<LoadingFallback />}>
              <Environment preset="city" />
              <Bounds fit clip observe margin={1.15}>
                <RotatingModel url={glbUrl} autoRotate={autoRotate} />
              </Bounds>
              <ContactShadow />
            </Suspense>
            <OrbitControls
              makeDefault
              enablePan={false}
              minDistance={0.5}
              maxDistance={20}
              dampingFactor={0.08}
              enableDamping
            />
            <AxisHint />
          </Canvas>

          <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">
            <span>drag · orbit  ·  scroll · zoom</span>
            <span>esc · close</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Badge({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-ink-700 bg-ink-950/60 px-2 py-1">
      <span className="text-[9px] uppercase tracking-[0.18em] text-ink-400">{label}</span>
      <span className={`text-[11px] text-ink-100 ${mono ? 'font-mono' : 'font-semibold'}`}>{value}</span>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function LoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[0.4, 0.4, 0.4]} />
      <meshStandardMaterial color="#ff7a1a" wireframe />
    </mesh>
  );
}

function ContactShadow() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.0, 0]} receiveShadow>
      <circleGeometry args={[3, 64]} />
      <meshBasicMaterial color="#000000" transparent opacity={0.35} />
    </mesh>
  );
}

function RotatingModel({ url, autoRotate }: { url: string; autoRotate: boolean }) {
  const { scene } = useGLTF(url);
  const group = useRef<THREE.Group>(null);
  const bounds = useBounds();

  const cloned = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    return c;
  }, [scene]);

  useEffect(() => {
    const id = requestAnimationFrame(() => bounds.refresh().clip().fit());
    return () => cancelAnimationFrame(id);
  }, [cloned, bounds]);

  useFrame((_, dt) => {
    if (autoRotate && group.current) {
      group.current.rotation.y += dt * 0.35;
    }
  });

  return (
    <group ref={group}>
      <primitive object={cloned} />
    </group>
  );
}

function AxisHint() {
  const { camera } = useThree();
  useEffect(() => {
    camera.up.set(0, 1, 0);
  }, [camera]);
  return null;
}
