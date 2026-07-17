import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Fog,
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Group,
  Mesh,
  Points,
  Vector3,
} from "three";

import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { usePageVisibility } from "../../hooks/usePageVisibility";
import { useResponsiveProfile } from "../../hooks/useResponsiveProfile";
import type { ResponsiveProfile } from "../../hooks/useResponsiveProfile";
import "../../journey.css";

type ProgressRef = React.MutableRefObject<number>;

const CinematicBloom = lazy(() => import("../three/CinematicBloom"));

const desktopCameraPoints = [
  new Vector3(0, 5.7, 15),
  new Vector3(-1.35, 2.7, 9.2),
  new Vector3(1.1, -0.9, 3.9),
  new Vector3(-0.95, -4.9, -2.2),
  new Vector3(1.15, -9.2, -8.9),
  new Vector3(0, -14.8, -16.2),
];

const tabletCameraPoints = desktopCameraPoints.map((point) => new Vector3(point.x * 0.76, point.y, point.z + 0.7));
const mobileCameraPoints = [
  new Vector3(0, 5.35, 17.4),
  new Vector3(-0.62, 2.85, 10.8),
  new Vector3(0.52, -0.72, 5.15),
  new Vector3(-0.46, -4.8, -1.55),
  new Vector3(0.5, -9.05, -8.45),
  new Vector3(0, -14.6, -15.8),
];

function clamp(value: number, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max);
}

function seededRandom(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function randomBetween(seed: number, min: number, max: number) {
  return min + seededRandom(seed) * (max - min);
}

function createThreadCurve(basePoints: Vector3[], offsetX: number, offsetY: number, offsetZ: number, phase: number) {
  return new CatmullRomCurve3(
    basePoints.map((point, index) => {
      const drift = Math.sin(index * 0.9 + phase);
      return new Vector3(
        point.x + offsetX + drift * 0.75,
        point.y + offsetY + Math.cos(index * 0.8 + phase) * 0.58,
        point.z + offsetZ + Math.sin(index * 0.72 + phase) * 1.35,
      );
    }),
    false,
    "catmullrom",
    0.48,
  );
}

function createSpiralCurve(basePoints: Vector3[], radius: number, phase: number, depthOffset: number, turns = 2.35, verticalScale = 0.42) {
  const points: Vector3[] = [];
  const pointCount = 26;
  const basePath = new CatmullRomCurve3(basePoints, false, "catmullrom", 0.55);

  for (let i = 0; i < pointCount; i++) {
    const t = i / (pointCount - 1);
    const center = new Vector3();
    basePath.getPointAt(t, center);
    const angle = phase + t * Math.PI * 2 * turns;
    const breathingRadius = radius * (0.74 + Math.sin(t * Math.PI * 2 + phase) * 0.16);
    points.push(
      new Vector3(
        center.x + Math.cos(angle) * breathingRadius,
        center.y + Math.sin(angle * 0.62 + phase) * verticalScale,
        center.z + Math.sin(angle) * breathingRadius + depthOffset,
      ),
    );
  }
  return new CatmullRomCurve3(points, false, "catmullrom", 0.5);
}

function createFateThreadCurve(path: CatmullRomCurve3, aspect: number, fov = 62, profile: ResponsiveProfile = "desktop") {
  const anchor = new Vector3();
  const lookAt = new Vector3();
  path.getPointAt(0.48, anchor);
  path.getPointAt(0.525, lookAt);

  const forward = lookAt.clone().sub(anchor).normalize();
  const up = new Vector3(0, 1, 0);
  const right = new Vector3().crossVectors(forward, up).normalize();
  const verticalFov = Math.tan((fov * Math.PI) / 360);
  const offsets = [
    { depth: 6, screenX: 0.86, screenY: 0.42 },
    { depth: 8, screenX: 0.875, screenY: 0.29 },
    { depth: 10.5, screenX: 0.865, screenY: 0.14 },
    { depth: 13.2, screenX: 0.88, screenY: -0.03 },
    { depth: 16.4, screenX: 0.9, screenY: -0.23 },
    { depth: 19.8, screenX: 0.89, screenY: -0.43 },
    { depth: 23.6, screenX: 0.915, screenY: -0.63 },
    { depth: 27.8, screenX: 0.94, screenY: -0.82 },
    { depth: 32.2, screenX: 0.965, screenY: -1 },
    { depth: 37, screenX: 0.99, screenY: -1.17 },
    { depth: 42, screenX: 1.01, screenY: -1.32 },
    { depth: 47.5, screenX: 1.035, screenY: -1.46 },
  ];

  const horizontalScale = profile === "mobile" ? 0.58 : profile === "tablet" ? 0.8 : 1;
  const verticalScale = profile === "mobile" ? 0.84 : 1;
  const points = offsets.map((offset) =>
    anchor
      .clone()
      .addScaledVector(forward, offset.depth)
      .addScaledVector(right, offset.screenX * horizontalScale * offset.depth * verticalFov * aspect)
      .addScaledVector(up, offset.screenY * verticalScale * offset.depth * verticalFov),
  );

  return {
    curve: new CatmullRomCurve3(points, false, "centripetal", 0.22),
    opacity: 0.58,
    glowOpacity: 0.16,
    color: "#d6334d",
    glowColor: "#8f1f33",
    coreRadius: 0.0032,
    glowRadius: 0.034,
  };
}

function CameraRig({
  progressRef,
  path,
  reducedMotion,
  isActive,
  profile,
  isLandscape,
}: {
  progressRef: ProgressRef;
  path: CatmullRomCurve3;
  reducedMotion: boolean;
  isActive: boolean;
  profile: ResponsiveProfile;
  isLandscape: boolean;
}) {
  const { camera } = useThree();
  const smoothProgress = useRef(reducedMotion ? 0.42 : 0);
  const position = useMemo(() => new Vector3(), []);
  const lookAt = useMemo(() => new Vector3(), []);
  const tangent = useMemo(() => new Vector3(), []);
  const nextTangent = useMemo(() => new Vector3(), []);
  const bankRef = useRef(0);

  useFrame(() => {
    if (!isActive) return;

    const targetProgress = reducedMotion ? 0.42 : progressRef.current;
    smoothProgress.current += (targetProgress - smoothProgress.current) * 0.055;
    const progress = clamp(smoothProgress.current);
    const nextProgress = clamp(progress + 0.045);
    const curveAhead = clamp(progress + 0.085);

    path.getPointAt(progress, position);
    path.getPointAt(nextProgress, lookAt);
    path.getTangentAt(progress, tangent);
    path.getTangentAt(curveAhead, nextTangent);

    camera.position.copy(position);
    camera.lookAt(lookAt);
    const turnPressure = clamp((nextTangent.x - tangent.x) * 2.4, -1, 1);
    const targetBank = turnPressure * 0.18 + Math.sin(progress * Math.PI * 3.2) * 0.035;
    bankRef.current += (targetBank - bankRef.current) * 0.08;
    camera.rotateZ(bankRef.current);
    if ("fov" in camera && typeof camera.fov === "number") {
      const targetFov = profile === "mobile" ? isLandscape ? 63 : 68 : profile === "tablet" ? 64 : 62;
      camera.fov += (targetFov - camera.fov) * 0.1;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}

function FocalOrb({
  progressRef,
  path,
  reducedMotion,
  isActive,
  profile,
}: {
  progressRef: ProgressRef;
  path: CatmullRomCurve3;
  reducedMotion: boolean;
  isActive: boolean;
  profile: ResponsiveProfile;
}) {
  const groupRef = useRef<Group>(null);
  const haloRef = useRef<Group>(null);
  const orbRef = useRef<Mesh>(null);
  const dustRef = useRef<Points>(null);
  const smoothProgress = useRef(reducedMotion ? 0.48 : 0.06);
  const point = useMemo(() => new Vector3(), []);
  const glowTexture = useMemo(() => createSoftParticleTexture(), []);
  const dustGeometry = useMemo(() => {
    const count = 150;
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const seed = 4400 + i * 5.61;
      const theta = randomBetween(seed, 0, Math.PI * 2);
      const phi = randomBetween(seed + 1, -0.9, 0.9);
      const radius = randomBetween(seed + 2, 0.08, 0.82);
      positions[i * 3] = Math.cos(theta) * Math.cos(phi) * radius;
      positions[i * 3 + 1] = Math.sin(phi) * radius * 0.64;
      positions[i * 3 + 2] = Math.sin(theta) * Math.cos(phi) * radius;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    return geometry;
  }, []);

  useEffect(() => {
    return () => {
      glowTexture?.dispose();
    };
  }, [glowTexture]);

  useFrame((state) => {
    if (!isActive) return;

    const targetProgress = reducedMotion ? 0.52 : clamp(progressRef.current + 0.12);
    smoothProgress.current += (targetProgress - smoothProgress.current) * 0.065;
    path.getPointAt(clamp(smoothProgress.current), point);

    if (groupRef.current) {
      groupRef.current.position.copy(point);
      groupRef.current.scale.setScalar(profile === "mobile" ? 1.24 : profile === "tablet" ? 1.1 : 1);
    }
    if (orbRef.current) {
      orbRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 1.8) * 0.06);
    }
    if (reducedMotion) return;

    if (haloRef.current) {
      haloRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 1.05) * 0.08);
    }
    if (dustRef.current) {
      dustRef.current.rotation.y = state.clock.elapsedTime * 0.1;
      dustRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.16) * 0.18;
    }
  });

  return (
    <group ref={groupRef}>
      <group ref={haloRef}>
        <sprite scale={[0.78, 0.78, 1]}>
          <spriteMaterial map={glowTexture} color="#9bdcff" transparent opacity={0.22} blending={AdditiveBlending} depthWrite={false} />
        </sprite>
        <sprite scale={[0.48, 0.48, 1]}>
          <spriteMaterial map={glowTexture} color="#f1e8d2" transparent opacity={0.18} blending={AdditiveBlending} depthWrite={false} />
        </sprite>
        <sprite scale={[0.3, 0.3, 1]}>
          <spriteMaterial map={glowTexture} color="#f8fdff" transparent opacity={0.54} blending={AdditiveBlending} depthWrite={false} />
        </sprite>
      </group>
      <mesh ref={orbRef}>
        <sphereGeometry args={[0.064, 32, 32]} />
        <meshBasicMaterial color="#f8fdff" transparent opacity={0.98} />
      </mesh>
      <points ref={dustRef} geometry={dustGeometry}>
        <pointsMaterial
          color="#f8fdff"
          map={glowTexture}
          size={0.014}
          sizeAttenuation
          transparent
          opacity={0.56}
          alphaTest={0.01}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </points>
    </group>
  );
}

function CosmicThreads({ path, profile }: { path: CatmullRomCurve3; profile: ResponsiveProfile }) {
  const threadData = useMemo(
    () => {
      const density = profile === "mobile" ? 0.78 : profile === "tablet" ? 0.9 : 1;
      const threads = [
        { curve: createThreadCurve(path.points, -1.2 * density, 0.2, -1.2, 0.2), color: "#f8fdff", radius: 0.0078, opacity: 0.26, glow: 11 },
        { curve: createThreadCurve(path.points, 1.85 * density, -0.55, 2.6, 1.4), color: "#9bdcff", radius: 0.0064, opacity: 0.24, glow: 10 },
        { curve: createThreadCurve(path.points, -2.65 * density, 0.9, 4.8, 4.35), color: "#9fc7f2", radius: 0.0038, opacity: 0.12, glow: 8.5 },
        { curve: createThreadCurve(path.points, 2.7 * density, -1.1, -4.8, 5.15), color: "#b9e5ff", radius: 0.0034, opacity: 0.11, glow: 8 },
        { curve: createSpiralCurve(path.points, 1.75 * density, 3.25, 0.8, 2.9, 0.58), color: "#f8fdff", radius: 0.0042, opacity: 0.19, glow: 11 },
        { curve: createSpiralCurve(path.points, 2.45 * density, 0.5, -1.6, 2.7, 0.52), color: "#9bdcff", radius: 0.0038, opacity: 0.18, glow: 10 },
        { curve: createSpiralCurve(path.points, 3.35, 4.75, -5.4, 2.15, 0.72), color: "#6f92bd", radius: 0.0024, opacity: 0.07, glow: 7 },
        { curve: createSpiralCurve(path.points, 4.75, 2.2, 5.2, 1.85, 0.86), color: "#f1d8d2", radius: 0.0028, opacity: 0.08, glow: 7.5 },
        { curve: path, color: "#eaf7ff", radius: 0.0026, opacity: 0.07, glow: 6 },
      ];
      return profile === "mobile" ? threads.slice(0, 6) : profile === "tablet" ? threads.slice(0, 8) : threads;
    },
    [path, profile],
  );

  return (
    <group>
      {threadData.map((thread, index) => (
        <group key={index}>
          <mesh>
            <tubeGeometry args={[thread.curve, 220, thread.radius * thread.glow, 12, false]} />
            <meshBasicMaterial color={thread.color} transparent opacity={thread.opacity * 0.05} blending={AdditiveBlending} depthWrite={false} />
          </mesh>
          <mesh>
            <tubeGeometry args={[thread.curve, 220, thread.radius * 2.5, 10, false]} />
            <meshBasicMaterial color={thread.color} transparent opacity={thread.opacity * 0.16} blending={AdditiveBlending} depthWrite={false} />
          </mesh>
          <mesh>
            <tubeGeometry args={[thread.curve, 220, thread.radius, 10, false]} />
            <meshBasicMaterial color={thread.color} transparent opacity={thread.opacity} blending={AdditiveBlending} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function FateThread({ path, profile }: { path: CatmullRomCurve3; profile: ResponsiveProfile }) {
  const { camera, size } = useThree();
  const cameraFov = "fov" in camera && typeof camera.fov === "number" ? camera.fov : 62;
  const thread = useMemo(() => createFateThreadCurve(path, size.width / Math.max(size.height, 1), cameraFov, profile), [cameraFov, path, profile, size.height, size.width]);

  return (
    <group>
      <mesh>
        <tubeGeometry args={[thread.curve, 260, thread.glowRadius, 10, false]} />
        <meshBasicMaterial color={thread.glowColor} transparent opacity={thread.glowOpacity} blending={AdditiveBlending} depthWrite={false} fog />
      </mesh>

      <mesh>
        <tubeGeometry args={[thread.curve, 260, thread.coreRadius, 8, false]} />
        <meshBasicMaterial color={thread.color} transparent opacity={thread.opacity} blending={AdditiveBlending} depthWrite={false} fog />
      </mesh>
    </group>
  );
}

function createParticleGeometry(path: CatmullRomCurve3, count: number, seedOffset: number, layer: "far" | "mid" | "close") {
  const positions = new Float32Array(count * 3);
  const center = new Vector3();

  for (let i = 0; i < count; i++) {
    const baseSeed = seedOffset + i * 9.73;
    const progress = seededRandom(baseSeed);
    path.getPointAt(progress, center);

    if (layer === "far") {
      const theta = randomBetween(baseSeed + 1, 0, Math.PI * 2);
      const radius = randomBetween(baseSeed + 2, 3.8, 38);
      positions[i * 3] = center.x + Math.cos(theta) * radius + randomBetween(baseSeed + 3, -10, 10);
      positions[i * 3 + 1] = center.y + Math.sin(theta) * radius * 0.62 + randomBetween(baseSeed + 4, -6.5, 6.5);
      positions[i * 3 + 2] = center.z + randomBetween(baseSeed + 5, -56, 56);
      continue;
    }

    if (layer === "mid") {
      const theta = randomBetween(baseSeed + 1, 0, Math.PI * 2);
      const radius = randomBetween(baseSeed + 2, 1.45, 8.2);
      positions[i * 3] = center.x + Math.cos(theta) * radius;
      positions[i * 3 + 1] = center.y + Math.sin(theta) * radius * 0.58 + randomBetween(baseSeed + 3, -2.2, 2.2);
      positions[i * 3 + 2] = center.z + randomBetween(baseSeed + 4, -14, 14);
      continue;
    }

    const theta = randomBetween(baseSeed + 1, 0, Math.PI * 2);
    const radius = randomBetween(baseSeed + 2, 0.16, 1.25);
    positions[i * 3] = center.x + Math.cos(theta) * radius;
    positions[i * 3 + 1] = center.y + Math.sin(theta) * radius * 0.72 + randomBetween(baseSeed + 3, -0.38, 0.38);
    positions[i * 3 + 2] = center.z + randomBetween(baseSeed + 4, -4.4, 4.4);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  return geometry;
}

function createSoftParticleTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;

  const context = canvas.getContext("2d");
  if (!context) return undefined;

  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 31);
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
  gradient.addColorStop(0.36, "rgba(255, 255, 255, 0.68)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);

  return new CanvasTexture(canvas);
}

function createNebulaTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;

  const context = canvas.getContext("2d");
  if (!context) return undefined;

  const base = context.createRadialGradient(128, 128, 0, 128, 128, 128);
  base.addColorStop(0, "rgba(232, 248, 255, 0.44)");
  base.addColorStop(0.24, "rgba(130, 190, 238, 0.18)");
  base.addColorStop(0.58, "rgba(68, 98, 150, 0.1)");
  base.addColorStop(1, "rgba(0, 0, 0, 0)");
  context.fillStyle = base;
  context.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 36; i++) {
    const seed = 7800 + i * 4.17;
    const x = randomBetween(seed, 34, 222);
    const y = randomBetween(seed + 1, 34, 222);
    const radius = randomBetween(seed + 2, 18, 58);
    const haze = context.createRadialGradient(x, y, 0, x, y, radius);
    haze.addColorStop(0, "rgba(246, 242, 229, 0.08)");
    haze.addColorStop(1, "rgba(235, 246, 255, 0)");
    context.fillStyle = haze;
    context.fillRect(0, 0, 256, 256);
  }

  return new CanvasTexture(canvas);
}

function CosmicParticles({ path, isActive, reducedMotion, profile }: { path: CatmullRomCurve3; isActive: boolean; reducedMotion: boolean; profile: ResponsiveProfile }) {
  const closeRef = useRef<Points>(null);
  const midRef = useRef<Points>(null);
  const farRef = useRef<Points>(null);
  const particleTexture = useMemo(() => createSoftParticleTexture(), []);

  const { closeGeometry, midGeometry, farGeometry } = useMemo(() => {
    return {
      farGeometry: createParticleGeometry(path, profile === "mobile" ? 3200 : profile === "tablet" ? 4800 : 6400, 100, "far"),
      midGeometry: createParticleGeometry(path, profile === "mobile" ? 480 : profile === "tablet" ? 620 : 760, 900, "mid"),
      closeGeometry: createParticleGeometry(path, profile === "mobile" ? 105 : profile === "tablet" ? 140 : 170, 1600, "close"),
    };
  }, [path, profile]);

  useEffect(() => {
    return () => {
      particleTexture?.dispose();
    };
  }, [particleTexture]);

  useFrame((state) => {
    if (!isActive || reducedMotion) return;

    if (closeRef.current) {
      closeRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.18) * 0.018;
      closeRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.22) * 0.012;
    }
    if (midRef.current) {
      midRef.current.rotation.y = state.clock.elapsedTime * 0.008;
      midRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.1) * 0.018;
    }
    if (farRef.current) {
      farRef.current.rotation.y = -state.clock.elapsedTime * 0.0025;
    }
  });

  return (
    <group>
      <points ref={farRef} geometry={farGeometry}>
        <pointsMaterial
          color="#789cc9"
          map={particleTexture}
          size={0.0042}
          sizeAttenuation
          transparent
          opacity={0.3}
          alphaTest={0.01}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </points>
      <points ref={midRef} geometry={midGeometry}>
        <pointsMaterial
          color="#b7dcff"
          map={particleTexture}
          size={0.014}
          sizeAttenuation
          transparent
          opacity={0.36}
          alphaTest={0.01}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </points>
      <points ref={closeRef} geometry={closeGeometry}>
        <pointsMaterial
          color="#f8fdff"
          map={particleTexture}
          size={0.044}
          sizeAttenuation
          transparent
          opacity={0.68}
          alphaTest={0.01}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </points>
    </group>
  );
}

function createGlintCurve(path: CatmullRomCurve3, progress: number, seed: number) {
  const center = new Vector3();
  const tangent = new Vector3();
  const points: Vector3[] = [];
  const theta = randomBetween(seed, 0, Math.PI * 2);
  const radius = randomBetween(seed + 1, 1.0, 5.2);
  const depth = randomBetween(seed + 2, -6.5, 7.8);
  const side = new Vector3(Math.cos(theta) * radius, Math.sin(theta) * radius * 0.42, depth);

  path.getPointAt(progress, center);
  path.getTangentAt(progress, tangent).normalize();

  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    const bend = Math.sin(t * Math.PI) * randomBetween(seed + 3, -0.18, 0.18);
    points.push(center.clone().add(side.clone().multiplyScalar(1 - t * 0.16)).addScaledVector(tangent, (t - 0.35) * randomBetween(seed + 4, 0.9, 2.1) + bend));
  }

  return new CatmullRomCurve3(points, false, "catmullrom", 0.35);
}

function LightGlints({ path, isActive, reducedMotion }: { path: CatmullRomCurve3; isActive: boolean; reducedMotion: boolean }) {
  const groupRef = useRef<Group>(null);
  const glints = useMemo(
    () =>
      [0.14, 0.27, 0.4, 0.54, 0.7, 0.86].map((progress, index) => ({
        curve: createGlintCurve(path, progress, 5200 + index * 13.7),
        color: ["#f8fdff", "#8fc7ee", "#f1e8d2", "#b9e5ff"][index % 4],
        radius: 0.0036 + (index % 2) * 0.001,
        opacity: 0.07 + (index % 3) * 0.012,
      })),
    [path],
  );

  useFrame((state) => {
    if (!isActive || reducedMotion) return;

    if (groupRef.current) {
      groupRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.14) * 0.01;
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.1) * 0.012;
    }
  });

  return (
    <group ref={groupRef}>
      {glints.map((glint, index) => (
        <group key={index}>
          <mesh>
            <tubeGeometry args={[glint.curve, 44, glint.radius * 6.4, 8, false]} />
            <meshBasicMaterial color={glint.color} transparent opacity={glint.opacity * 0.2} blending={AdditiveBlending} depthWrite={false} />
          </mesh>
          <mesh>
            <tubeGeometry args={[glint.curve, 44, glint.radius, 8, false]} />
            <meshBasicMaterial color={glint.color} transparent opacity={glint.opacity * 0.55} blending={AdditiveBlending} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function NebulaVeils({ path }: { path: CatmullRomCurve3 }) {
  const nebulaTexture = useMemo(() => createNebulaTexture(), []);
  const veils = useMemo(() => {
    return [0.08, 0.18, 0.31, 0.46, 0.6, 0.74, 0.9].map((progress, index) => {
      const point = new Vector3();
      path.getPointAt(progress, point);
      point.x += Math.sin(index * 1.7) * (2.4 + index * 0.42);
      point.y += Math.cos(index * 1.15) * 1.55;
      point.z += Math.cos(index * 1.4) * 9.2;
      return {
        point,
        scale: 5.4 + index * 1.28,
        opacity: index % 2 === 0 ? 0.068 : 0.045,
        rotation: randomBetween(8500 + index, -0.5, 0.5),
      };
    });
  }, [path]);

  useEffect(() => {
    return () => {
      nebulaTexture?.dispose();
    };
  }, [nebulaTexture]);

  return (
    <group>
      {veils.map((veil, index) => (
        <sprite key={index} position={veil.point} scale={[veil.scale, veil.scale * 0.62, 1]} rotation={[0, 0, veil.rotation]}>
          <spriteMaterial
            map={nebulaTexture}
            color={index % 3 === 0 ? "#9bdcff" : index % 3 === 1 ? "#9fc7f2" : "#f8fdff"}
            transparent
            opacity={veil.opacity}
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </sprite>
      ))}
    </group>
  );
}

function GlowNodes({ path }: { path: CatmullRomCurve3 }) {
  const nodes = useMemo(() => {
    return [0.28, 0.57, 0.78].map((progress, index) => {
      const point = new Vector3();
      path.getPointAt(progress, point);
      point.x += Math.sin(index * 1.9 + 0.6) * (1.8 + index * 0.55);
      point.y += Math.cos(index * 1.35) * 0.85;
      point.z += Math.cos(index * 1.45) * (2.8 + index * 1.9);
      return {
        point,
        color: index % 2 === 0 ? "#f8fdff" : "#b9e5ff",
        scale: 0.018 + index * 0.004,
      };
    });
  }, [path]);

  return (
    <group>
      {nodes.map((node, index) => (
        <group key={index} position={node.point}>
          <mesh>
            <sphereGeometry args={[node.scale * 4.4, 20, 20]} />
            <meshBasicMaterial color={node.color} transparent opacity={0.035} blending={AdditiveBlending} depthWrite={false} />
          </mesh>
          <mesh>
            <sphereGeometry args={[node.scale, 16, 16]} />
            <meshBasicMaterial color={node.color} transparent opacity={0.46} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function CosmicPOVScene({
  progressRef,
  reducedMotion,
  isActive,
  profile,
  isLandscape,
}: {
  progressRef: ProgressRef;
  reducedMotion: boolean;
  isActive: boolean;
  profile: ResponsiveProfile;
  isLandscape: boolean;
}) {
  const pathPoints = profile === "mobile" ? mobileCameraPoints : profile === "tablet" ? tabletCameraPoints : desktopCameraPoints;
  const path = useMemo(() => new CatmullRomCurve3(pathPoints, false, "catmullrom", 0.55), [pathPoints]);

  useEffect(() => {
    return () => {
      document.body.style.cursor = "";
    };
  }, []);

  return (
    <>
      <color attach="background" args={["#020716"]} />
      <fog attach="fog" args={["#020716", 2.1, 36] as unknown as ConstructorParameters<typeof Fog>} />
      <ambientLight intensity={0.11} color="#7faee0" />
      <pointLight position={[0, 4, 8]} intensity={0.62} color="#f8fdff" />
      <CameraRig progressRef={progressRef} path={path} reducedMotion={reducedMotion} isActive={isActive} profile={profile} isLandscape={isLandscape} />
      <NebulaVeils path={path} />
      <CosmicParticles path={path} isActive={isActive} reducedMotion={reducedMotion} profile={profile} />
      <CosmicThreads path={path} profile={profile} />
      <FateThread path={path} profile={profile} />
      <LightGlints path={path} isActive={isActive} reducedMotion={reducedMotion} />
      <GlowNodes path={path} />
      <FocalOrb progressRef={progressRef} path={path} reducedMotion={reducedMotion} isActive={isActive} profile={profile} />
      {!reducedMotion && (
        <Suspense fallback={null}>
          <CinematicBloom profile={profile} variant="cosmic" />
        </Suspense>
      )}
    </>
  );
}

export function CosmicPOVSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const progressRef = useRef(0);
  const entryFadeRef = useRef<HTMLDivElement>(null);
  const endFadeRef = useRef<HTMLDivElement>(null);
  const [isActive, setIsActive] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const isPageVisible = usePageVisibility();
  const { profile, isLandscape } = useResponsiveProfile();

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    if (typeof IntersectionObserver === "undefined") {
      setIsActive(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsActive(entry.isIntersecting);
      },
      { rootMargin: "120px 0px", threshold: 0.01 },
    );

    observer.observe(section);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || !isActive) return;

    let rafId = 0;
    const updateProgress = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const rect = section.getBoundingClientRect();
        const travel = section.offsetHeight - window.innerHeight;
        const progress = clamp(-rect.top / Math.max(travel, 1));
        progressRef.current = progress;
        if (entryFadeRef.current) {
          entryFadeRef.current.style.opacity = String(1 - clamp(progress / 0.075));
        }
        if (endFadeRef.current) {
          const fadeProgress = clamp((progress - 0.8) / 0.2);
          endFadeRef.current.style.opacity = String(Math.pow(fadeProgress, 1.35));
        }
      });
    };

    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    updateProgress();

    return () => {
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
      cancelAnimationFrame(rafId);
    };
  }, [isActive, reducedMotion]);

  return (
    <section
      ref={sectionRef}
      className="cosmic-pov-section relative z-0 isolate bg-[#020716]"
      style={{ marginTop: "-1px" }}
      aria-label="Cosmic POV scroll journey"
    >
      <div className="cosmic-pov-sticky pointer-events-none sticky top-0 z-0 w-full overflow-hidden bg-[#020716]">
        <div
          className="absolute inset-0 transition-opacity duration-700 ease-out will-change-opacity"
          style={{ opacity: isActive ? 1 : 0 }}
        >
          <Canvas
            camera={{ position: [0, 5.5, 14], fov: 62, near: 0.01, far: 80 }}
            dpr={[1, profile === "desktop" ? 1.5 : profile === "tablet" ? 1.4 : 1.2]}
            frameloop={isActive && isPageVisible && !reducedMotion ? "always" : "demand"}
            gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
            className="absolute inset-0 h-full w-full"
          >
            <CosmicPOVScene progressRef={progressRef} reducedMotion={reducedMotion} isActive={isActive && isPageVisible} profile={profile} isLandscape={isLandscape} />
          </Canvas>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 52% 50%, rgba(110,160,220,0.1) 0%, rgba(110,160,220,0.035) 28%, transparent 56%), radial-gradient(circle at 42% 62%, rgba(246,242,229,0.045) 0%, transparent 42%), radial-gradient(circle at 50% 48%, transparent 0%, transparent 46%, rgba(0,0,0,0.5) 100%), linear-gradient(180deg, rgba(3,7,18,0.88) 0%, rgba(2,7,18,0.14) 16%, transparent 44%, rgba(2,7,18,0.18) 72%, rgba(12,16,28,0.9) 100%)",
            }}
          />
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[#020716] transition-opacity duration-700 ease-out"
          style={{ opacity: isActive ? 0 : 1 }}
        />
        <div
          ref={entryFadeRef}
          aria-hidden="true"
          className="cosmic-entry-veil pointer-events-none absolute inset-0 will-change-opacity"
        />
        <div
          ref={endFadeRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-0 will-change-opacity"
          style={{
            background:
              "radial-gradient(circle at 50% 42%, rgba(5,7,12,0.9) 0%, rgba(5,7,12,0.97) 52%, #05070c 100%)",
          }}
        />
      </div>
    </section>
  );
}
