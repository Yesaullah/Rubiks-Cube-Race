import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { COLORS, CUBIES, NORMALS, STICKERS, dot, moveAngle, type Vec3 } from "./geometry";

interface Props {
  facelets: string;   // state to show once any animation finishes
  move: string | null; // move that produced `facelets` (animated from the previous state)
  seq: number;        // increments on every new move
  durationMs?: number;
}

interface Anim { move: string; from: string; to: string; start: number }

function Piece({ pos }: { pos: Vec3 }) {
  return (
    <RoundedBox args={[0.96, 0.96, 0.96]} radius={0.08} smoothness={3} position={pos}>
      <meshStandardMaterial color="#1a1d23" roughness={0.55} />
    </RoundedBox>
  );
}

function StickerMesh({ pos, normal, color }: { pos: Vec3; normal: Vec3; color: string }) {
  const p: Vec3 = [pos[0] + normal[0] * 0.485, pos[1] + normal[1] * 0.485, pos[2] + normal[2] * 0.485];
  const q = useMemo(() => {
    const quat = new THREE.Quaternion();
    quat.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...normal));
    return quat;
  }, [normal]);
  return (
    <mesh position={p} quaternion={q}>
      <planeGeometry args={[0.82, 0.82]} />
      <meshStandardMaterial color={color} roughness={0.35} side={THREE.DoubleSide} />
    </mesh>
  );
}

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function CubeModel({ facelets, move, seq, durationMs = 220 }: Props) {
  const [shown, setShown] = useState(facelets);
  const [anim, setAnim] = useState<Anim | null>(null);
  const layer = useRef<THREE.Group>(null);
  const prevSeq = useRef(seq);
  const target = useRef(facelets); // latest committed state (end of the newest move)

  useEffect(() => {
    if (seq === prevSeq.current + 1 && move) {
      // exactly one new move: animate it from the previous target state
      setAnim({ move, from: target.current, to: facelets, start: performance.now() });
    } else {
      // reset, replay seek, or several moves at once: jump straight to the state
      setShown(facelets);
      setAnim(null);
    }
    prevSeq.current = seq;
    target.current = facelets;
  }, [seq, facelets, move]);

  // reset the turning layer before paint whenever a new animation starts or one ends
  useLayoutEffect(() => {
    layer.current?.rotation.set(0, 0, 0);
  }, [anim]);

  useFrame(() => {
    if (!anim || !layer.current) return;
    // reduced motion: no turning, the new state appears at once
    const k = reducedMotion() ? 1 : Math.min(1, (performance.now() - anim.start) / durationMs);
    const eased = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    const axis = new THREE.Vector3(...NORMALS[anim.move[0]]);
    layer.current.setRotationFromAxisAngle(axis, moveAngle(anim.move) * eased);
    if (k >= 1) {
      setShown(anim.to);
      setAnim(null);
    }
  });

  const state = anim ? anim.from : shown;
  const axis = anim ? NORMALS[anim.move[0]] : null;
  const inLayer = (p: Vec3) => axis !== null && dot(p, axis) === 1;

  const render = (filter: (p: Vec3) => boolean) => (
    <>
      {CUBIES.filter(filter).map((p) => <Piece key={p.join()} pos={p} />)}
      {STICKERS.filter((s) => filter(s.pos)).map((s) => (
        <StickerMesh key={s.index} pos={s.pos} normal={s.normal} color={COLORS[state[s.index]] ?? "#888"} />
      ))}
    </>
  );

  return (
    <group rotation={[0.12, -0.25, 0]}>
      <group ref={layer}>{render(inLayer)}</group>
      <group>{render((p) => !inLayer(p))}</group>
    </group>
  );
}

export default function Cube3D(props: Props) {
  return (
    <Canvas camera={{ position: [5.3, 4.5, 6.9], fov: 30 }} dpr={[1, 2]} gl={{ antialias: true }}
      aria-label="3D view of this engine's cube" role="img">
      <ambientLight intensity={1.5} />
      <directionalLight position={[5, 8, 6]} intensity={1.7} />
      <directionalLight position={[-6, -3, -4]} intensity={0.45} />
      <CubeModel {...props} />
    </Canvas>
  );
}
