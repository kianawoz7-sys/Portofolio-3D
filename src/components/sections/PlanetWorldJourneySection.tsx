import type { MutableRefObject, ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import type { MotionValue } from "motion/react";
import { motion, useScroll, useSpring, useTransform } from "motion/react";
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  DoubleSide,
  Fog,
  Group,
  LineBasicMaterial,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Points,
  PointsMaterial,
  PerspectiveCamera,
  Quaternion,
  TubeGeometry,
  Vector3,
} from "three";

import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { useResponsiveProfile } from "../../hooks/useResponsiveProfile";
import { PROJECTS } from "../../data/projects";
import {
  ARCHIVE_CINEMATIC_LIMIT,
  getArchiveCameraPose,
  getArchiveConstellationPosition,
  getArchiveConstellationProgressStart,
  getArchiveProgressWindow,
  getArchiveThreadPoints,
  getArchiveVaultTransform,
  remapJourneyProgressForArchive,
} from "../../lib/archiveJourney";
import { getRawJourneyProgress } from "../../lib/journeyNavigation";
import { AboutArchiveContent } from "./AboutArchiveContent";
import { ArchiveThreadDestination, ArchiveVault } from "./ArchiveVault";
import { ListeningCapsuleWorld } from "./ListeningCapsuleWorld";
import type { ListeningPlaybackSnapshot } from "./ListeningCapsuleWorld";

type ProgressRef = MutableRefObject<number>;
type PlanetChapter = "memory" | "system" | "archive" | "listening" | "void" | "signal";

interface PlanetJourneyContextValue {
  progress: MotionValue<number>;
  reducedMotion: boolean;
  archiveProgressRef: ProgressRef;
  archiveActiveRef: MutableRefObject<boolean>;
}

const PlanetJourneyContext = createContext<PlanetJourneyContextValue | null>(null);

const discoveryRanges: Record<PlanetChapter, [number, number, number, number]> = {
  memory: [0.085, 0.115, 0.235, 0.268],
  system: [0.24, 0.275, 0.382, 0.415],
  archive: [0.38, 0.415, 0.605, 0.64],
  listening: [0.6, 0.635, 0.728, 0.76],
  void: [0.73, 0.765, 0.912, 0.95],
  signal: [0.895, 0.915, 0.985, 1],
};

const chapterDirections: Record<PlanetChapter, number> = {
  memory: -1,
  system: 1,
  archive: -1,
  listening: 1,
  void: 0,
  signal: 0,
};

export function usePlanetChapterState(chapter: PlanetChapter) {
  const context = useContext(PlanetJourneyContext);
  if (!context) throw new Error("Planet chapter content must be rendered inside PlanetWorldJourneySection.");

  const range = discoveryRanges[chapter];
  const direction = chapterDirections[chapter];
  const { progress, reducedMotion } = context;
  const isFinalSignal = chapter === "signal";
  const opacity = useTransform(progress, range, [0, 1, 1, chapter === "signal" ? 1 : 0]);
  const x = useTransform(progress, range, reducedMotion || isFinalSignal ? [0, 0, 0, 0] : [direction * 52, 0, 0, direction * -30]);
  const y = useTransform(progress, range, reducedMotion ? [0, 0, 0, 0] : isFinalSignal ? [30, 0, 0, 0] : [38, 0, 0, -28]);
  const scale = useTransform(progress, range, reducedMotion ? [1, 1, 1, 1] : isFinalSignal ? [0.96, 1, 1, 1] : [0.92, 1, 1, 0.965]);
  const rotateY = useTransform(progress, range, reducedMotion || isFinalSignal ? [0, 0, 0, 0] : [direction * -3.2, 0, 0, direction * 1.6]);
  const filter = useTransform(
    progress,
    range,
    reducedMotion
      ? ["blur(0px)", "blur(0px)", "blur(0px)", "blur(0px)"]
      : isFinalSignal
        ? ["blur(0px)", "blur(0px)", "blur(0px)", "blur(0px)"]
        : ["blur(9px)", "blur(0px)", "blur(0px)", "blur(5px)"],
  );

  return { opacity, x, y, scale, rotateY, filter };
}

export function useArchiveJourneyControls() {
  const context = useContext(PlanetJourneyContext);
  if (!context) throw new Error("Archive journey controls must be used inside PlanetWorldJourneySection.");
  return {
    archiveProgressRef: context.archiveProgressRef,
    archiveActiveRef: context.archiveActiveRef,
  };
}

const cameraPoints = [
  new Vector3(0, 7.2, 28),
  new Vector3(0, 4.2, 17),
  new Vector3(-3.2, 1.5, 6),
  new Vector3(-0.8, 0.8, -9),
  new Vector3(2.8, 0.6, -27),
  new Vector3(-3.8, 1.2, -47),
  new Vector3(3.6, 0.5, -65),
  new Vector3(0, 2.2, -83),
  new Vector3(0, 1.2, -103),
];

const threadPoints = [
  new Vector3(-1.4, -2.65, 8),
  new Vector3(-4.8, 1.4, -10),
  new Vector3(3.4, 0.5, -29),
  new Vector3(-4.2, 1.8, -49),
  new Vector3(4.1, 0.7, -68),
  new Vector3(-1.2, 2.3, -86),
  new Vector3(0, 1.1, -115),
];

function chapterWeight(progress: number, start: number, end: number, fade = 0.045) {
  const enter = MathUtils.smoothstep(progress, start, start + fade);
  const exit = 1 - MathUtils.smoothstep(progress, end - fade, end);
  return Math.min(enter, exit);
}

const cameraProgressStops: Array<[number, number]> = [
  [0, 0],
  [0.06, 0.08],
  [0.1, 0.16],
  [0.12, 0.23],
  [0.17, 0.3],
  [0.24, 0.31],
  [0.28, 0.38],
  [0.31, 0.43],
  [0.34, 0.47],
  [0.39, 0.49],
  [0.43, 0.56],
  [0.47, 0.6],
  [0.53, 0.63],
  [0.58, 0.68],
  [0.63, 0.7],
  [0.66, 0.74],
  [0.7, 0.77],
  [0.75, 0.79],
  [0.78, 0.84],
  [0.86, 0.86],
  [0.89, 0.92],
  [0.94, 0.96],
  [1, 1],
];

function remapCameraProgress(progress: number) {
  const value = MathUtils.clamp(progress, 0, 1);
  for (let index = 0; index < cameraProgressStops.length - 1; index += 1) {
    const [inputStart, outputStart] = cameraProgressStops[index];
    const [inputEnd, outputEnd] = cameraProgressStops[index + 1];
    if (value <= inputEnd) {
      const local = MathUtils.clamp((value - inputStart) / (inputEnd - inputStart), 0, 1);
      const eased = local * local * (3 - 2 * local);
      return MathUtils.lerp(outputStart, outputEnd, eased);
    }
  }
  return 1;
}

function CameraJourney({
  progressRef,
  archiveProgressRef,
  archiveActiveRef,
  listeningPlaybackRef,
  reducedMotion,
  isActive,
  profile,
}: {
  progressRef: ProgressRef;
  archiveProgressRef: ProgressRef;
  archiveActiveRef: MutableRefObject<boolean>;
  listeningPlaybackRef: MutableRefObject<ListeningPlaybackSnapshot>;
  reducedMotion: boolean;
  isActive: boolean;
  profile: "desktop" | "tablet" | "mobile";
}) {
  const { camera, size } = useThree();
  const path = useMemo(() => new CatmullRomCurve3(cameraPoints, false, "catmullrom", 0.48), []);
  const smoothProgress = useRef(0);
  const target = useMemo(() => new Vector3(), []);
  const lookTarget = useMemo(() => new Vector3(), []);
  const smoothLook = useMemo(() => new Vector3(0, 0, 0), []);
  const memoryCamera = useMemo(() => new Vector3(-3.85, 0.78, -5.85), []);
  const memoryLook = useMemo(() => new Vector3(-4.8, 0.15, -11), []);
  const systemApproachCamera = useMemo(() => new Vector3(4.25, 2.45, -20.5), []);
  const systemInspectionCamera = useMemo(() => new Vector3(3.55, 0.95, -25.65), []);
  const systemCameraTarget = useMemo(() => new Vector3(), []);
  const systemLook = useMemo(() => new Vector3(2.1, 0.2, -31), []);
  const systemLookTarget = useMemo(() => new Vector3(), []);
  const archiveCameraTarget = useMemo(() => new Vector3(), []);
  const archiveLookTarget = useMemo(() => new Vector3(), []);
  const listeningCameraTarget = useMemo(() => new Vector3(), []);
  const listeningLookTarget = useMemo(() => new Vector3(4.1, 0.65, -68), []);
  const voidCameraTarget = useMemo(() => new Vector3(), []);
  const voidLookTarget = useMemo(() => new Vector3(0, 2.05, -91), []);
  const finalSignalCameraTarget = useMemo(() => new Vector3(0, 1.35, -108.2), []);
  const finalSignalLookTarget = useMemo(() => new Vector3(0, 1.1, -116), []);
  const finalArchiveWindow = useMemo(
    () => getArchiveProgressWindow(Math.max(0, Math.min(PROJECTS.length, ARCHIVE_CINEMATIC_LIMIT) - 1), PROJECTS.length),
    [],
  );

  useFrame((state) => {
    if (!isActive) return;

    const rawProgress = progressRef.current;
    const mobileLandscape = profile === "mobile" && size.width > size.height;
    const systemArrival = MathUtils.smoothstep(rawProgress, 0.225, 0.285);
    const systemDeparture = 1 - MathUtils.smoothstep(rawProgress, 0.39, 0.445);
    const systemFocus = Math.min(systemArrival, systemDeparture);
    const systemPushIn = MathUtils.smoothstep(rawProgress, 0.245, 0.345);
    const systemInspection = systemFocus * MathUtils.smoothstep(rawProgress, 0.285, 0.35);
    const archiveProgress = archiveProgressRef.current;
    const archiveArrival = MathUtils.smoothstep(archiveProgress, 0, 0.035);
    const archiveDeparture = 1 - MathUtils.smoothstep(archiveProgress, finalArchiveWindow.discoveryEnd, 1);
    const archiveFocus = archiveActiveRef.current ? Math.min(archiveArrival, archiveDeparture) : 0;
    const activeArchivePose = getArchiveCameraPose(archiveProgress, PROJECTS);
    const archiveInspectionHold = activeArchivePose.inspectionWeight;
    const listeningFocus = chapterWeight(rawProgress, 0.555, 0.825, 0.05);
    const listeningPlayback = listeningPlaybackRef.current;
    const listeningLocalProgress = MathUtils.clamp((rawProgress - 0.555) / (0.825 - 0.555), 0, 1);
    const listeningScrollInspection = MathUtils.smoothstep(listeningLocalProgress, 0.2, 0.35)
      * (1 - MathUtils.smoothstep(listeningLocalProgress, 0.8, 1));
    const listeningInspection = Math.max(listeningScrollInspection, listeningPlayback.isPlaying ? listeningFocus : 0);
    const listeningCrescendo = MathUtils.smoothstep(listeningPlayback.currentTime, 20, 26)
      * (1 - MathUtils.smoothstep(listeningPlayback.currentTime, 26, Math.max(27, listeningPlayback.duration)));
    const listeningPush = listeningPlayback.isPlaying && !reducedMotion
      ? listeningCrescendo * (0.42 + listeningPlayback.level * 0.44)
      : 0;
    const voidFocus = chapterWeight(rawProgress, 0.705, 0.94, 0.04);
    const voidLocalProgress = MathUtils.clamp((rawProgress - 0.705) / (0.94 - 0.705), 0, 1);
    const signalApproach = MathUtils.smoothstep(rawProgress, 0.918, 0.955);
    const desired = remapCameraProgress(rawProgress);
    const cinematicInspection = Math.max(systemInspection, archiveFocus, listeningFocus, voidFocus, signalApproach);
    const smoothing = reducedMotion ? 0.28 : MathUtils.lerp(0.062, 0.026, cinematicInspection);
    smoothProgress.current += (desired - smoothProgress.current) * smoothing;
    const progress = MathUtils.clamp(smoothProgress.current, 0, 1);

    path.getPointAt(progress, target);
    path.getPointAt(Math.min(1, progress + 0.055), lookTarget);
    const memoryArrival = MathUtils.smoothstep(rawProgress, 0.09, 0.145);
    const memoryDeparture = 1 - MathUtils.smoothstep(rawProgress, 0.225, 0.285);
    const memoryFocus = Math.min(memoryArrival, memoryDeparture);
    systemCameraTarget.copy(systemApproachCamera).lerp(systemInspectionCamera, systemPushIn);
    systemLookTarget.copy(systemLook);
    if (!reducedMotion) {
      const cameraArc = Math.sin(state.clock.elapsedTime * 0.18) * systemInspection;
      systemCameraTarget.x += cameraArc * 0.26;
      systemCameraTarget.y += Math.cos(state.clock.elapsedTime * 0.14) * systemInspection * 0.08;
      systemLookTarget.x += cameraArc * 0.1;
    }

    target.lerp(memoryCamera, memoryFocus * 0.72);
    lookTarget.lerp(memoryLook, memoryFocus * 0.92);
    target.lerp(systemCameraTarget, systemFocus * 0.94);
    lookTarget.lerp(systemLookTarget, systemFocus * 0.97);

    if (archiveFocus > 0.001) {
      const archivePose = activeArchivePose;
      archiveCameraTarget.fromArray(archivePose.position);
      archiveLookTarget.fromArray(archivePose.lookAt);
      if (profile === "mobile") archiveCameraTarget.z += mobileLandscape ? -0.35 : -0.85;
      else if (profile === "tablet") archiveCameraTarget.z -= 0.35;
      if (!reducedMotion && archiveInspectionHold > 0) {
        const inspectionDrift = Math.sin(state.clock.elapsedTime * 0.12 + archivePose.activeIndex) * 0.008 * archiveInspectionHold;
        archiveCameraTarget.x += inspectionDrift;
        archiveLookTarget.x += inspectionDrift * 0.35;
      }
      target.lerp(archiveCameraTarget, archiveFocus);
      lookTarget.lerp(archiveLookTarget, archiveFocus);
    }

    if (listeningFocus > 0.001) {
      listeningCameraTarget.set(3.82, profile === "mobile" ? 1.05 : 0.92, (profile === "mobile" ? -63.45 : -64.2) - listeningPush * 0.72);
      listeningLookTarget.set(4.1, 0.65, -68);
      if (!reducedMotion) {
        const capsuleArc = Math.sin(state.clock.elapsedTime * 0.11) * MathUtils.lerp(0.035, 0.006, listeningInspection) * listeningFocus;
        listeningCameraTarget.x += capsuleArc;
        listeningLookTarget.x += capsuleArc * 0.25;
      }
      target.lerp(listeningCameraTarget, listeningFocus * MathUtils.lerp(0.94, 0.998, listeningInspection));
      lookTarget.lerp(listeningLookTarget, listeningFocus * MathUtils.lerp(0.97, 0.999, listeningInspection));
    }

    if (voidFocus > 0.001) {
      const exitTravel = MathUtils.smoothstep(voidLocalProgress, 0.78, 1);
      const voidDrift = reducedMotion ? 0 : Math.sin(state.clock.elapsedTime * 0.07) * 0.018 * voidFocus;
      voidCameraTarget.set(0.18 + voidDrift, 2.25 - exitTravel * 0.12, -82.25 - exitTravel * 1.1);
      voidLookTarget.set(voidDrift * 0.2, 2.05 - exitTravel * 0.34, -91 - exitTravel * 1.8);
      target.lerp(voidCameraTarget, voidFocus * 0.997);
      lookTarget.lerp(voidLookTarget, voidFocus * 0.999);
    }

    if (signalApproach > 0.001) {
      target.lerp(finalSignalCameraTarget, signalApproach);
      lookTarget.lerp(finalSignalLookTarget, signalApproach);
    }

    const inspectionCameraFollow = MathUtils.lerp(MathUtils.lerp(0.12, 0.05, cinematicInspection), 0.085, archiveInspectionHold);
    const inspectionLookFollow = MathUtils.lerp(MathUtils.lerp(0.1, 0.048, cinematicInspection), 0.08, archiveInspectionHold);
    const voidCameraFollow = MathUtils.lerp(inspectionCameraFollow, 0.028, voidFocus);
    const voidLookFollow = MathUtils.lerp(inspectionLookFollow, 0.024, voidFocus);
    const cameraFollow = MathUtils.lerp(voidCameraFollow, 0.085, signalApproach);
    const lookFollow = MathUtils.lerp(voidLookFollow, 0.09, signalApproach);
    camera.position.lerp(target, reducedMotion ? 0.42 : cameraFollow);
    smoothLook.lerp(lookTarget, reducedMotion ? 0.42 : lookFollow);
    camera.lookAt(smoothLook);

    if (camera instanceof PerspectiveCamera) {
      const responsiveFov = profile === "mobile" ? mobileLandscape ? 4.5 : 7 : profile === "tablet" ? 3 : 0;
      const targetFov = 54 + responsiveFov - memoryFocus * 4.5 + systemFocus * 1.2 - systemInspection * 3.2 - archiveFocus * 2.2 - listeningPush * 1.1 - voidFocus * 1.2 - signalApproach * 5.5;
      camera.fov += (targetFov - camera.fov) * (reducedMotion ? 0.35 : 0.08);
      camera.updateProjectionMatrix();
    }
  });

  return null;
}

function PlanetArrival({ progressRef, reducedMotion, isActive }: { progressRef: ProgressRef; reducedMotion: boolean; isActive: boolean }) {
  const groupRef = useRef<Group>(null);
  const surfaceRef = useRef<MeshStandardMaterial>(null);
  const atmosphereRef = useRef<MeshBasicMaterial>(null);

  useFrame((state) => {
    if (!isActive) return;
    const progress = progressRef.current;
    const opacity = 1 - MathUtils.smoothstep(progress, 0.08, 0.205);

    if (surfaceRef.current) surfaceRef.current.opacity = opacity;
    if (atmosphereRef.current) atmosphereRef.current.opacity = opacity * 0.16;
    if (groupRef.current) {
      groupRef.current.visible = opacity > 0.008;
      groupRef.current.rotation.y = reducedMotion ? 0 : state.clock.elapsedTime * 0.006;
      groupRef.current.position.y = -21 + MathUtils.smoothstep(progress, 0, 0.18) * 2.1;
    }
  });

  return (
    <group ref={groupRef} position={[0, -21, -1]}>
      <mesh>
        <sphereGeometry args={[20, 72, 48]} />
        <meshStandardMaterial
          ref={surfaceRef}
          color="#06131d"
          emissive="#0c3144"
          emissiveIntensity={0.42}
          metalness={0.08}
          opacity={1}
          roughness={0.88}
          transparent
        />
      </mesh>
      <mesh scale={1.035}>
        <sphereGeometry args={[20, 64, 40]} />
        <meshBasicMaterial
          ref={atmosphereRef}
          blending={AdditiveBlending}
          color="#8bd8f2"
          depthWrite={false}
          opacity={0.16}
          side={BackSide}
          transparent
        />
      </mesh>
    </group>
  );
}

function LandingTrail({ progressRef, reducedMotion, isActive }: { progressRef: ProgressRef; reducedMotion: boolean; isActive: boolean }) {
  const groupRef = useRef<Group>(null);
  const ringRef = useRef<Mesh>(null);
  const domeRef = useRef<Group>(null);
  const curve = useMemo(
    () => new CatmullRomCurve3([
      new Vector3(0.4, 0.3, 17),
      new Vector3(-0.1, -0.2, 14),
      new Vector3(-0.8, -0.9, 11),
      threadPoints[0].clone(),
    ], false, "catmullrom", 0.5),
    [],
  );
  const geometry = useMemo(() => new TubeGeometry(curve, 90, 0.035, 6, false), [curve]);
  const trailMaterial = useMemo(
    () => new MeshBasicMaterial({ color: "#bfefff", transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }),
    [],
  );
  const ringMaterial = useMemo(
    () => new MeshBasicMaterial({ color: "#83c9df", transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }),
    [],
  );
  const destinationMaterials = useMemo(() => ({
    halo: new MeshBasicMaterial({ color: "#72c6e4", transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }),
    dome: new MeshPhysicalMaterial({ color: "#a8dcea", transparent: true, opacity: 0, depthWrite: false, roughness: 0.18, transmission: 0.82, thickness: 0.08, ior: 1.22, side: DoubleSide }),
    edge: new MeshBasicMaterial({ color: "#c4effb", transparent: true, opacity: 0, depthWrite: false }),
    node: new MeshBasicMaterial({ color: "#d9f6ff", transparent: true, opacity: 0, depthWrite: false }),
    grid: new MeshBasicMaterial({ color: "#6aa9c1", transparent: true, opacity: 0, depthWrite: false, wireframe: true }),
    mist: new MeshBasicMaterial({ color: "#4d9ab5", transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending, side: BackSide }),
  }), []);

  useEffect(() => () => {
    geometry.dispose();
    trailMaterial.dispose();
    ringMaterial.dispose();
    Object.values(destinationMaterials).forEach((material) => material.dispose());
  }, [destinationMaterials, geometry, ringMaterial, trailMaterial]);

  useFrame((state) => {
    if (!isActive || !groupRef.current) return;
    const progress = progressRef.current;
    const arrival = MathUtils.smoothstep(progress, 0.015, 0.085);
    const exit = 1 - MathUtils.smoothstep(progress, 0.14, 0.235);
    const weight = arrival * exit;
    const destinationWeight = (0.38 + arrival * 0.62) * exit;
    groupRef.current.visible = destinationWeight > 0.008;
    trailMaterial.opacity = weight * 0.68;
    ringMaterial.opacity = destinationWeight * 0.42;
    destinationMaterials.halo.opacity = destinationWeight * 0.055;
    destinationMaterials.dome.opacity = destinationWeight * 0.045;
    destinationMaterials.edge.opacity = destinationWeight * 0.26;
    destinationMaterials.node.opacity = destinationWeight * 0.5;
    destinationMaterials.grid.opacity = destinationWeight * 0.042;
    destinationMaterials.mist.opacity = destinationWeight * 0.025;
    if (ringRef.current) {
      const pulse = reducedMotion ? 1 : 1 + Math.sin(state.clock.elapsedTime * 1.1) * 0.14;
      ringRef.current.scale.setScalar(pulse);
    }
    if (domeRef.current && !reducedMotion) {
      domeRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.18) * 0.035;
      domeRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.34) * 0.018;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh geometry={geometry} material={trailMaterial} />
      <group position={threadPoints[0]} rotation={[0.47, 0, -0.07]}>
        <mesh material={destinationMaterials.grid} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.018, 0]}>
          <planeGeometry args={[7.6, 4.8, 11, 7]} />
        </mesh>
        <mesh material={destinationMaterials.halo} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
          <circleGeometry args={[2.75, 56]} />
        </mesh>
        <mesh ref={ringRef} material={ringMaterial} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.82, 0.024, 6, 80]} />
        </mesh>
        <mesh material={ringMaterial} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.13, 0.009, 5, 96]} />
        </mesh>

        <group ref={domeRef} position={[0, 0.035, -0.08]}>
          <mesh material={destinationMaterials.dome}>
            <sphereGeometry args={[1.26, 36, 18, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          {[-0.62, 0, 0.62].map((rotationY) => (
            <mesh key={rotationY} material={destinationMaterials.edge} rotation={[0, rotationY, 0]}>
              <torusGeometry args={[1.27, 0.008, 5, 64, Math.PI]} />
            </mesh>
          ))}
          <mesh material={destinationMaterials.edge} rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.27, 0.012, 5, 72]} />
          </mesh>
          <mesh material={destinationMaterials.mist} scale={[1.7, 0.72, 1.7]} position={[0, 0.25, 0]}>
            <sphereGeometry args={[1.15, 20, 12]} />
          </mesh>
        </group>

        {[
          [-2.6, 0.04, -0.5],
          [-1.82, 0.055, 1.18],
          [1.9, 0.05, 1.02],
          [2.72, 0.04, -0.76],
          [3.42, 0.035, 0.38],
        ].map(([x, y, z], index) => (
          <mesh key={index} material={destinationMaterials.node} position={[x, y, z]}>
            <sphereGeometry args={[index === 1 ? 0.035 : 0.026, 8, 8]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function DigitalTerrain({ progressRef, isActive }: { progressRef: ProgressRef; isActive: boolean }) {
  const solidRef = useRef<MeshStandardMaterial>(null);
  const wireRef = useRef<MeshBasicMaterial>(null);
  const geometry = useMemo(() => {
    const terrain = new PlaneGeometry(68, 150, 34, 76);
    const positions = terrain.attributes.position as BufferAttribute;
    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index);
      const y = positions.getY(index);
      const elevation = Math.sin(x * 0.24) * 0.42 + Math.cos(y * 0.13) * 0.34 + Math.sin((x + y) * 0.09) * 0.22;
      positions.setZ(index, elevation);
    }
    positions.needsUpdate = true;
    terrain.computeVertexNormals();
    return terrain;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(() => {
    if (!isActive) return;
    const progress = progressRef.current;
    const enter = MathUtils.smoothstep(progress, 0.065, 0.18);
    const exit = 1 - MathUtils.smoothstep(progress, 0.9, 1);
    const systemQuiet = MathUtils.smoothstep(progress, 0.215, 0.285) * (1 - MathUtils.smoothstep(progress, 0.405, 0.465));
    const listeningQuiet = chapterWeight(progress, 0.535, 0.845, 0.06);
    const listeningAttenuation = MathUtils.lerp(1, 0.16, listeningQuiet);
    const voidQuiet = chapterWeight(progress, 0.7, 0.95, 0.04);
    const voidAttenuation = MathUtils.lerp(1, 0.1, voidQuiet);
    const finalQuiet = MathUtils.smoothstep(progress, 0.885, 0.93);
    const finalAttenuation = MathUtils.lerp(1, 0.02, finalQuiet);
    if (solidRef.current) solidRef.current.opacity = enter * exit * MathUtils.lerp(0.82, 0.025, systemQuiet) * listeningAttenuation * voidAttenuation * finalAttenuation;
    if (wireRef.current) wireRef.current.opacity = enter * exit * MathUtils.lerp(0.1, 0.0005, systemQuiet) * listeningAttenuation * voidAttenuation * finalAttenuation;
  });

  return (
    <group position={[0, -5.1, -55]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          ref={solidRef}
          color="#071019"
          emissive="#0b2a39"
          emissiveIntensity={0.22}
          metalness={0.18}
          opacity={0}
          roughness={0.9}
          side={DoubleSide}
          transparent
        />
      </mesh>
      <mesh geometry={geometry} position={[0, 0, 0.035]}>
        <meshBasicMaterial ref={wireRef} color="#78b8cf" opacity={0} transparent wireframe />
      </mesh>
    </group>
  );
}

function AmbientStarfield({ progressRef, reducedMotion, isActive }: { progressRef: ProgressRef; reducedMotion: boolean; isActive: boolean }) {
  const pointsRef = useRef<Points>(null);
  const geometry = useMemo(() => {
    const positions = new Float32Array(900 * 3);
    for (let index = 0; index < 900; index += 1) {
      const seed = index + 1;
      positions[index * 3] = Math.sin(seed * 91.73) * 30;
      positions[index * 3 + 1] = -3 + ((seed * 47.17) % 21);
      positions[index * 3 + 2] = 24 - ((seed * 31.61) % 154);
    }
    const buffer = new BufferGeometry();
    buffer.setAttribute("position", new BufferAttribute(positions, 3));
    return buffer;
  }, []);
  const material = useMemo(
    () => new PointsMaterial({ color: "#d8f3ff", size: 0.052, sizeAttenuation: true, transparent: true, opacity: 0.38, depthWrite: false }),
    [],
  );

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  useFrame((state) => {
    if (!isActive || !pointsRef.current) return;
    const progress = progressRef.current;
    const calm = MathUtils.smoothstep(progress, 0.72, 0.86);
    const systemQuiet = MathUtils.smoothstep(progress, 0.215, 0.285) * (1 - MathUtils.smoothstep(progress, 0.405, 0.465));
    const listeningQuiet = chapterWeight(progress, 0.535, 0.845, 0.06);
    const voidQuiet = chapterWeight(progress, 0.7, 0.95, 0.04);
    const finalQuiet = MathUtils.smoothstep(progress, 0.885, 0.93);
    const twinkleRange = MathUtils.lerp(0.04, 0.012, voidQuiet);
    const ambientTwinkle = reducedMotion ? 1 : 1 - twinkleRange + Math.sin(state.clock.elapsedTime * 0.12) * twinkleRange;
    material.opacity = MathUtils.lerp(0.38, 0.065, calm) * (1 - systemQuiet * 0.68) * MathUtils.lerp(1, 0.28, listeningQuiet) * MathUtils.lerp(1, 0.14, voidQuiet) * MathUtils.lerp(1, 0.18, finalQuiet) * ambientTwinkle;
    if (!reducedMotion) {
      const motionAttenuation = MathUtils.lerp(1, 0.06, voidQuiet);
      pointsRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.025) * 0.012 * (1 - calm) * motionAttenuation;
      pointsRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.075) * 0.055 * (1 - calm) * motionAttenuation;
    }
  });

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}

function WorldThread({
  progressRef,
  archiveProgressRef,
  archiveActiveRef,
  listeningPlaybackRef,
  reducedMotion,
  isActive,
}: {
  progressRef: ProgressRef;
  archiveProgressRef: ProgressRef;
  archiveActiveRef: MutableRefObject<boolean>;
  listeningPlaybackRef: MutableRefObject<ListeningPlaybackSnapshot>;
  reducedMotion: boolean;
  isActive: boolean;
}) {
  const groupRef = useRef<Group>(null);
  const curve = useMemo(() => new CatmullRomCurve3(threadPoints, false, "catmullrom", 0.5), []);
  const redCurve = useMemo(
    () => new CatmullRomCurve3(threadPoints.slice(3).map((point, index) => point.clone().add(new Vector3(index * 0.08, -0.18, 0))), false, "catmullrom", 0.5),
    [],
  );
  const blueGeometry = useMemo(() => new TubeGeometry(curve, 220, 0.022, 5, false), [curve]);
  const redGeometry = useMemo(() => new TubeGeometry(redCurve, 110, 0.018, 5, false), [redCurve]);
  const blueMaterial = useMemo(
    () => new MeshBasicMaterial({ color: "#98d6ea", transparent: true, opacity: 0.3, depthWrite: false, blending: AdditiveBlending }),
    [],
  );
  const redMaterial = useMemo(
    () => new MeshBasicMaterial({ color: "#a93849", transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }),
    [],
  );
  const nodeMaterial = useMemo(
    () => new MeshBasicMaterial({ color: "#e6f8ff", transparent: true, opacity: 0.72, depthWrite: false }),
    [],
  );
  const nodes = useMemo(() => Array.from({ length: 15 }, (_, index) => curve.getPointAt(0.05 + index * 0.064)), [curve]);
  const finalArchiveWindow = useMemo(
    () => getArchiveProgressWindow(Math.max(0, Math.min(PROJECTS.length, ARCHIVE_CINEMATIC_LIMIT) - 1), PROJECTS.length),
    [],
  );

  useEffect(() => () => {
    blueGeometry.dispose();
    redGeometry.dispose();
    blueMaterial.dispose();
    redMaterial.dispose();
    nodeMaterial.dispose();
  }, [blueGeometry, blueMaterial, nodeMaterial, redGeometry, redMaterial]);

  useFrame((state) => {
    if (!isActive) return;
    const progress = progressRef.current;
    const collapse = MathUtils.smoothstep(progress, 0.965, 1);
    const systemQuiet = MathUtils.smoothstep(progress, 0.215, 0.285) * (1 - MathUtils.smoothstep(progress, 0.405, 0.465));
    const archiveProgress = archiveProgressRef.current;
    const archiveQuiet = archiveActiveRef.current
      ? MathUtils.smoothstep(archiveProgress, 0, 0.035) * (1 - MathUtils.smoothstep(archiveProgress, finalArchiveWindow.discoveryEnd, 1))
      : 0;
    const listening = listeningPlaybackRef.current;
    const listeningWeight = chapterWeight(progress, 0.555, 0.825, 0.05);
    const listeningPulse = listeningWeight * (listening.isPlaying ? 0.12 + listening.level * 0.88 : 0);
    const threadQuiet = MathUtils.lerp(1, 0.3, listeningWeight);
    const voidQuiet = chapterWeight(progress, 0.7, 0.95, 0.04);
    const voidThreadAttenuation = MathUtils.lerp(1, 0.012, voidQuiet);
    const voidNodeAttenuation = MathUtils.lerp(1, 0.01, voidQuiet);
    const finalSuppression = 1 - MathUtils.smoothstep(progress, 0.86, 0.895);
    blueMaterial.opacity = Math.min(0.54, 0.3 * (1 - collapse) * (1 - systemQuiet * 0.995) * (1 - archiveQuiet * 0.995) * threadQuiet * voidThreadAttenuation * finalSuppression * (1 + listeningPulse * 0.62));
    nodeMaterial.opacity = Math.min(0.92, 0.72 * (1 - collapse) * (1 - systemQuiet * 0.98) * (1 - archiveQuiet * 0.99) * MathUtils.lerp(1, 0.24, listeningWeight) * voidNodeAttenuation * finalSuppression * (1 + listeningPulse * 0.28));
    const redJourneyOpacity = (chapterWeight(progress, 0.37, 0.96, 0.08) * 0.42 * (1 - systemQuiet * 0.84) * (1 - archiveQuiet * 0.995) * MathUtils.lerp(1, 0.42, listeningWeight) + listeningPulse * 0.09) * voidThreadAttenuation;
    redMaterial.opacity = Math.min(0.42, redJourneyOpacity * finalSuppression);
    if (groupRef.current) groupRef.current.rotation.z = reducedMotion ? 0 : Math.sin(state.clock.elapsedTime * 0.08) * 0.004 * MathUtils.lerp(1, 0.06, voidQuiet);
  });

  return (
    <group ref={groupRef}>
      <mesh geometry={blueGeometry} material={blueMaterial} />
      <mesh geometry={redGeometry} material={redMaterial} />
      {nodes.map((position, index) => (
        <mesh key={index} position={position} material={nodeMaterial}>
          <sphereGeometry args={[index % 4 === 0 ? 0.105 : 0.064, 10, 10]} />
        </mesh>
      ))}
    </group>
  );
}

function MemoryLocation({
  progressRef,
  reducedMotion,
  isActive,
  profile,
}: {
  progressRef: ProgressRef;
  reducedMotion: boolean;
  isActive: boolean;
  profile: "desktop" | "tablet" | "mobile";
}) {
  const groupRef = useRef<Group>(null);
  const sweepRef = useRef<Group>(null);
  const contentAnchorRef = useRef<Group>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const contentWorldPosition = useMemo(() => new Vector3(), []);
  const glass = useMemo(
    () => new MeshPhysicalMaterial({
      color: "#b9e7f5",
      emissive: "#173f52",
      emissiveIntensity: 0.26,
      transparent: true,
      opacity: 0,
      roughness: 0.13,
      metalness: 0.02,
      transmission: 0.72,
      thickness: 0.32,
      ior: 1.34,
      depthWrite: false,
      side: DoubleSide,
    }),
    [],
  );
  const accent = useMemo(
    () => new MeshBasicMaterial({ color: "#d8f5ff", transparent: true, opacity: 0, depthWrite: false }),
    [],
  );
  const mist = useMemo(
    () => new MeshBasicMaterial({ color: "#4f91aa", transparent: true, opacity: 0, depthWrite: false, side: BackSide, blending: AdditiveBlending }),
    [],
  );
  const panelGlass = useMemo(
    () => new MeshPhysicalMaterial({
      color: "#6fa4b8",
      emissive: "#0d2a37",
      emissiveIntensity: 0.12,
      transparent: true,
      opacity: 0,
      roughness: 0.2,
      metalness: 0.01,
      transmission: 0.9,
      thickness: 0.08,
      ior: 1.18,
      depthWrite: false,
      side: DoubleSide,
    }),
    [],
  );
  const floor = useMemo(
    () => new MeshStandardMaterial({ color: "#07141d", emissive: "#0c2e3d", emissiveIntensity: 0.44, transparent: true, opacity: 0, roughness: 0.78, metalness: 0.18, depthWrite: false }),
    [],
  );
  const dustGeometry = useMemo(() => {
    const positions = new Float32Array(64 * 3);
    for (let index = 0; index < 64; index += 1) {
      const seed = index + 1;
      positions[index * 3] = Math.sin(seed * 31.17) * 3.5;
      positions[index * 3 + 1] = Math.cos(seed * 17.43) * 2.4;
      positions[index * 3 + 2] = Math.sin(seed * 9.71) * 1.25;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    return geometry;
  }, []);
  const dustMaterial = useMemo(
    () => new PointsMaterial({ color: "#d7f4ff", size: 0.045, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false }),
    [],
  );

  useEffect(() => () => {
    glass.dispose();
    accent.dispose();
    mist.dispose();
    panelGlass.dispose();
    floor.dispose();
    dustGeometry.dispose();
    dustMaterial.dispose();
  }, [accent, dustGeometry, dustMaterial, floor, glass, mist, panelGlass]);

  useFrame((state) => {
    if (!isActive || !groupRef.current) return;
    const progress = progressRef.current;
    const weight = chapterWeight(progress, 0.055, 0.34, 0.06);
    const threshold = MathUtils.smoothstep(progress, 0.075, 0.155);
    const contentEnter = MathUtils.smoothstep(progress, 0.115, 0.165);
    const contentDeparture = MathUtils.smoothstep(progress, 0.235, 0.285);
    groupRef.current.visible = weight > 0.008;
    groupRef.current.scale.setScalar(0.78 + weight * 0.22);
    groupRef.current.rotation.y = 0.08 + (reducedMotion ? 0 : Math.sin(state.clock.elapsedTime * 0.12) * 0.012);
    groupRef.current.position.y = -0.15 + threshold * 0.18 + (reducedMotion ? 0 : Math.sin(state.clock.elapsedTime * 0.2) * 0.06);
    glass.opacity = weight * (0.035 + threshold * 0.06);
    panelGlass.opacity = weight * contentEnter * (1 - contentDeparture) * 0.052;
    accent.opacity = weight * (0.16 + threshold * 0.28);
    mist.opacity = weight * 0.055;
    floor.opacity = weight * 0.48;
    dustMaterial.opacity = weight * 0.48;

    if (sweepRef.current) {
      sweepRef.current.rotation.y = reducedMotion ? -0.42 : -0.55 + state.clock.elapsedTime * 0.08;
    }

    if (contentAnchorRef.current) {
      contentAnchorRef.current.getWorldPosition(contentWorldPosition);
      const cameraDistance = state.camera.position.distanceTo(contentWorldPosition);
      const distanceReadability = 1 - MathUtils.smoothstep(cameraDistance, 8.6, 14.5);
      const contentVisibility = Math.min(contentEnter, 1 - contentDeparture, distanceReadability);

      contentAnchorRef.current.position.set(
        (profile === "mobile" ? 0.69 : profile === "tablet" ? 0.71 : 0.4)
          + (reducedMotion ? 0 : Math.sin(state.clock.elapsedTime * 0.18) * 0.035),
        0.12 + contentEnter * 0.08,
        -0.34 + contentEnter * 0.86 - contentDeparture * 1.08,
      );
      contentAnchorRef.current.rotation.set(
        reducedMotion ? 0 : Math.sin(state.clock.elapsedTime * 0.14) * 0.008,
        -0.035 + (reducedMotion ? 0 : Math.sin(state.clock.elapsedTime * 0.11) * 0.012),
        reducedMotion ? 0 : Math.sin(state.clock.elapsedTime * 0.1) * 0.004,
      );
      contentAnchorRef.current.scale.setScalar(0.86 + contentVisibility * 0.14);

      if (contentRef.current) {
        contentRef.current.style.opacity = contentVisibility.toFixed(3);
        contentRef.current.style.filter = reducedMotion ? "none" : `blur(${((1 - contentVisibility) * 7).toFixed(2)}px)`;
        contentRef.current.style.pointerEvents = contentVisibility > 0.86 ? "auto" : "none";
        contentRef.current.style.setProperty("--memory-anchor-focus", contentVisibility.toFixed(3));
      }
    }
  });

  return (
    <group ref={groupRef} position={[-4.8, -0.15, -11]} rotation={[0.02, 0.08, -0.018]}>
      <mesh material={glass} position={[0, -1.82, 0]}>
        <sphereGeometry args={[5.65, 56, 32, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh material={mist} position={[0, -1.78, 0]} scale={0.965}>
        <sphereGeometry args={[5.65, 40, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>

      <mesh material={floor} position={[0, -1.87, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[5.62, 64]} />
      </mesh>
      <mesh material={accent} position={[0, -1.82, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[5.64, 0.028, 8, 128]} />
      </mesh>

      {[-0.72, 0, 0.72].map((rotationY) => (
        <mesh key={rotationY} material={accent} position={[0, -1.82, 0]} rotation={[0, rotationY, 0]}>
          <torusGeometry args={[5.64, 0.014, 6, 96, Math.PI]} />
        </mesh>
      ))}
      {[
        { y: -1.08, radius: 5.6 },
        { y: 0.18, radius: 5.28 },
        { y: 1.38, radius: 4.62 },
      ].map(({ y, radius }) => (
        <mesh key={y} material={accent} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius, 0.01, 5, 112]} />
        </mesh>
      ))}
      <mesh material={accent} position={[0, -1.82, 4.45]}>
        <torusGeometry args={[3.15, 0.022, 8, 96, Math.PI]} />
      </mesh>

      <group ref={sweepRef} position={[0, -1.82, 0]}>
        <mesh material={accent} rotation={[0, 0.2, 0]}>
          <torusGeometry args={[5.69, 0.032, 8, 72, Math.PI * 0.32]} />
        </mesh>
      </group>

      <group position={[-1.72, 0.15, 0.08]} rotation={[0, -0.12, 0]}>
        <mesh material={accent} position={[0, 1.72, 0]}><boxGeometry args={[2.32, 0.025, 0.025]} /></mesh>
        <mesh material={accent} position={[0, -1.72, 0]}><boxGeometry args={[2.32, 0.025, 0.025]} /></mesh>
        <mesh material={accent} position={[-1.16, 0, 0]}><boxGeometry args={[0.025, 3.46, 0.025]} /></mesh>
        <mesh material={accent} position={[1.16, 0, 0]}><boxGeometry args={[0.025, 3.46, 0.025]} /></mesh>
        {[
          [-1.16, -1.72], [-1.16, 1.72], [1.16, -1.72], [1.16, 1.72],
        ].map(([x, y]) => (
          <mesh key={`${x}-${y}`} material={accent} position={[x, y, 0.02]}>
            <sphereGeometry args={[0.045, 8, 8]} />
          </mesh>
        ))}
      </group>
      <mesh material={panelGlass} position={[1.42, 0.5, -0.18]} rotation={[0, 0.08, 0]}>
        <planeGeometry args={[3.35, 1.82]} />
      </mesh>
      <group position={[1.42, 0.5, -0.14]} rotation={[0, 0.08, 0]}>
        <mesh material={accent} position={[0, 0.92, 0]}><boxGeometry args={[3.38, 0.014, 0.014]} /></mesh>
        <mesh material={accent} position={[-1.69, 0, 0]}><boxGeometry args={[0.014, 1.84, 0.014]} /></mesh>
        <mesh material={accent} position={[1.69, 0, 0]}><boxGeometry args={[0.014, 1.84, 0.014]} /></mesh>
      </group>
      <mesh material={accent} position={[-3.28, -1.74, 4.18]}>
        <sphereGeometry args={[0.08, 10, 10]} />
      </mesh>
      <points geometry={dustGeometry} material={dustMaterial} />

      <group ref={contentAnchorRef} position={[0, 0.12, -0.34]}>
        <Html
          transform
          center
          distanceFactor={profile === "mobile" ? 1.68 : profile === "tablet" ? 1.05 : 1.75}
          position={[0, 0, 0]}
          rotation={[0, 0, 0]}
          zIndexRange={[8, 3]}
          pointerEvents="auto"
        >
          <AboutArchiveContent ref={contentRef} />
        </Html>
      </group>
    </group>
  );
}

type SystemNodeTier = "primary" | "secondary" | "ambient";

const systemTierStrength = {
  primary: 1,
  secondary: 0.62,
  ambient: 0.34,
};

const systemOrbits = [
  {
    label: "FRONTEND LAYER",
    radius: 2.62,
    tilt: [0.94, 0.18, -0.12] as [number, number, number],
    speed: 0.052,
    technologies: [
      { name: "React", tier: "primary" as SystemNodeTier },
      { name: "TypeScript", tier: "primary" as SystemNodeTier },
      { name: "Tailwind CSS", tier: "secondary" as SystemNodeTier },
      { name: "Vite", tier: "ambient" as SystemNodeTier },
    ],
  },
  {
    label: "BACKEND LAYER",
    radius: 2.28,
    tilt: [0.18, 1.08, 0.34] as [number, number, number],
    speed: -0.043,
    technologies: [
      { name: "Node.js", tier: "primary" as SystemNodeTier },
      { name: "Express", tier: "secondary" as SystemNodeTier },
      { name: "PostgreSQL", tier: "secondary" as SystemNodeTier },
      { name: "Supabase", tier: "secondary" as SystemNodeTier },
    ],
  },
  {
    label: "DELIVERY LAYER",
    radius: 3.04,
    tilt: [0.58, -0.52, -0.28] as [number, number, number],
    speed: 0.032,
    technologies: [
      { name: "Firebase", tier: "ambient" as SystemNodeTier },
      { name: "Vercel", tier: "ambient" as SystemNodeTier },
      { name: "API Integration", tier: "ambient" as SystemNodeTier },
    ],
  },
];

function SystemLocation({ progressRef, reducedMotion, isActive }: { progressRef: ProgressRef; reducedMotion: boolean; isActive: boolean }) {
  const groupRef = useRef<Group>(null);
  const coreRef = useRef<Mesh>(null);
  const coreCageRef = useRef<Mesh>(null);
  const coreLabelAnchorRef = useRef<Group>(null);
  const orbitRefs = useRef<Array<Group | null>>([]);
  const nodeRefs = useRef<Array<Mesh | null>>([]);
  const labelRefs = useRef<Array<Group | null>>([]);
  const labelElementRefs = useRef<Array<HTMLDivElement | null>>([]);
  const labelVisibility = useRef<number[]>([]);
  const labelFocus = useRef<number[]>([]);
  const categoryRefs = useRef<Array<Group | null>>([]);
  const categoryElementRefs = useRef<Array<HTMLDivElement | null>>([]);
  const categoryVisibility = useRef<number[]>([]);
  const coreLabelRef = useRef<HTMLDivElement>(null);
  const parentQuaternion = useMemo(() => new Quaternion(), []);
  const cameraQuaternion = useMemo(() => new Quaternion(), []);
  const localCameraQuaternion = useMemo(() => new Quaternion(), []);
  const billboardQuaternion = useMemo(() => new Quaternion(), []);
  const labelWorldPosition = useMemo(() => new Vector3(), []);
  const coreMaterial = useMemo(
    () => new MeshStandardMaterial({ color: "#102d38", emissive: "#174c5e", emissiveIntensity: 0.48, transparent: true, opacity: 0, roughness: 0.34, metalness: 0.58, depthWrite: false }),
    [],
  );
  const coreHaloMaterial = useMemo(
    () => new MeshBasicMaterial({ color: "#6ebed5", transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }),
    [],
  );
  const coreLightMaterial = useMemo(
    () => new MeshBasicMaterial({ color: "#e6faff", transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }),
    [],
  );
  const coreFrameMaterial = useMemo(
    () => new MeshBasicMaterial({ color: "#9bcddd", transparent: true, opacity: 0, depthWrite: false }),
    [],
  );
  const coreCageMaterial = useMemo(
    () => new MeshBasicMaterial({ color: "#79afc0", wireframe: true, transparent: true, opacity: 0, depthWrite: false }),
    [],
  );
  const primaryNodeMaterial = useMemo(
    () => new MeshBasicMaterial({ color: "#e3f9ff", transparent: true, opacity: 0, depthWrite: false }),
    [],
  );
  const secondaryNodeMaterial = useMemo(
    () => new MeshBasicMaterial({ color: "#a6d4e1", transparent: true, opacity: 0, depthWrite: false }),
    [],
  );
  const ambientNodeMaterial = useMemo(
    () => new MeshBasicMaterial({ color: "#668d9b", transparent: true, opacity: 0, depthWrite: false }),
    [],
  );
  const lineMaterial = useMemo(
    () => new LineBasicMaterial({ color: "#86bfd3", transparent: true, opacity: 0, depthWrite: false }),
    [],
  );
  const ringMaterial = useMemo(
    () => new MeshBasicMaterial({ color: "#8ac8dc", transparent: true, opacity: 0, depthWrite: false }),
    [],
  );
  const secondaryRingMaterial = useMemo(
    () => new MeshBasicMaterial({ color: "#5d91a4", transparent: true, opacity: 0, depthWrite: false }),
    [],
  );
  const accentRingMaterial = useMemo(
    () => new MeshBasicMaterial({ color: "#a94d57", transparent: true, opacity: 0, depthWrite: false }),
    [],
  );
  const nodes = useMemo(() => {
    let index = 0;
    return systemOrbits.flatMap((orbit, orbitIndex) => orbit.technologies.map((technology, slot) => {
      const angle = (slot / orbit.technologies.length) * Math.PI * 2 + orbitIndex * 0.48;
      const node = {
        ...technology,
        index,
        orbitIndex,
        position: new Vector3(Math.cos(angle) * orbit.radius, Math.sin(angle) * orbit.radius, 0),
      };
      index += 1;
      return node;
    }));
  }, []);

  useEffect(() => () => {
    coreMaterial.dispose();
    coreHaloMaterial.dispose();
    coreLightMaterial.dispose();
    coreFrameMaterial.dispose();
    coreCageMaterial.dispose();
    primaryNodeMaterial.dispose();
    secondaryNodeMaterial.dispose();
    ambientNodeMaterial.dispose();
    lineMaterial.dispose();
    ringMaterial.dispose();
    secondaryRingMaterial.dispose();
    accentRingMaterial.dispose();
  }, [accentRingMaterial, ambientNodeMaterial, coreCageMaterial, coreFrameMaterial, coreHaloMaterial, coreLightMaterial, coreMaterial, lineMaterial, primaryNodeMaterial, ringMaterial, secondaryNodeMaterial, secondaryRingMaterial]);

  useFrame((state) => {
    if (!isActive || !groupRef.current) return;
    const progress = progressRef.current;
    const weight = chapterWeight(progress, 0.2, 0.5);
    const inspection = MathUtils.smoothstep(progress, 0.285, 0.345) * (1 - MathUtils.smoothstep(progress, 0.39, 0.445));
    const mobileViewport = state.size.width < 768 || (state.size.height < 520 && state.size.width < 950);
    const tabletViewport = !mobileViewport && state.size.width < 1100;
    const systemScale = mobileViewport ? 0.82 : tabletViewport ? 0.92 : 1;
    groupRef.current.visible = weight > 0.008;
    groupRef.current.scale.setScalar((0.66 + weight * 0.18 + inspection * 0.025) * systemScale);
    groupRef.current.rotation.y = reducedMotion ? 0 : Math.sin(state.clock.elapsedTime * 0.11) * 0.025;
    groupRef.current.position.y = 0.2 + (reducedMotion ? 0 : Math.sin(state.clock.elapsedTime * 0.19) * 0.06);
    const corePulse = reducedMotion ? 1 : 1 + Math.sin(state.clock.elapsedTime * 1.05) * 0.035;
    if (coreRef.current) {
      coreRef.current.rotation.x = reducedMotion ? 0 : state.clock.elapsedTime * 0.08;
      coreRef.current.rotation.y = reducedMotion ? 0 : state.clock.elapsedTime * -0.055;
      coreRef.current.scale.setScalar(corePulse);
    }
    if (coreCageRef.current) {
      coreCageRef.current.rotation.x = reducedMotion ? 0.24 : 0.24 - state.clock.elapsedTime * 0.025;
      coreCageRef.current.rotation.y = reducedMotion ? -0.18 : -0.18 + state.clock.elapsedTime * 0.035;
    }
    orbitRefs.current.forEach((orbit, index) => {
      if (!orbit) return;
      orbit.rotation.z = reducedMotion ? index * 0.36 : state.clock.elapsedTime * systemOrbits[index].speed + index * 0.36;
    });
    coreMaterial.opacity = weight * 0.9;
    coreMaterial.emissiveIntensity = 0.46 + inspection * 0.1 + (corePulse - 1) * 1.2;
    coreHaloMaterial.opacity = weight * (0.012 + inspection * 0.007 + (corePulse - 1) * 0.12);
    coreLightMaterial.opacity = weight * (0.3 + inspection * 0.08);
    coreFrameMaterial.opacity = weight * 0.16;
    coreCageMaterial.opacity = weight * (0.035 + inspection * 0.025);
    primaryNodeMaterial.opacity = weight * 0.4;
    secondaryNodeMaterial.opacity = weight * 0.2;
    ambientNodeMaterial.opacity = weight * 0.09;
    lineMaterial.opacity = weight * 0.045;
    ringMaterial.opacity = weight * 0.14;
    secondaryRingMaterial.opacity = weight * 0.045;
    accentRingMaterial.opacity = weight * 0.06;
    if (coreLabelRef.current) {
      coreLabelRef.current.style.opacity = (weight * (0.2 + inspection * 0.58)).toFixed(3);
      coreLabelRef.current.style.filter = reducedMotion ? "none" : `blur(${((1 - inspection) * 1.8).toFixed(2)}px)`;
    }
    if (coreLabelAnchorRef.current) {
      coreLabelAnchorRef.current.parent?.getWorldQuaternion(parentQuaternion);
      state.camera.getWorldQuaternion(cameraQuaternion);
      localCameraQuaternion.copy(parentQuaternion).invert().multiply(cameraQuaternion);
      billboardQuaternion.identity().slerp(localCameraQuaternion, 0.9);
      coreLabelAnchorRef.current.quaternion.slerp(billboardQuaternion, reducedMotion ? 0.2 : 0.075);
    }
    nodeRefs.current.forEach((node, index) => {
      if (!node) return;
      const nodeConfig = nodes[index];
      if (!nodeConfig) return;
      const activation = MathUtils.smoothstep(progress, 0.235 + index * 0.008, 0.275 + index * 0.008);
      node.visible = activation > 0.01;
      node.scale.setScalar(0.35 + activation * 0.65);

      const label = labelRefs.current[index];
      const labelElement = labelElementRefs.current[index];
      const tier = nodeConfig.tier;
      if (!label || !labelElement) return;

      label.getWorldPosition(labelWorldPosition);
      const distance = state.camera.position.distanceTo(labelWorldPosition);
      const proximity = 1 - MathUtils.smoothstep(distance, 4.2, 11.4);
      const breathe = reducedMotion ? 0.86 : 0.7 + Math.sin(state.clock.elapsedTime * 0.42 + index * 1.47) * 0.18;
      const proximityCurve = Math.pow(proximity, 1.55);
      const distanceVisibility = (tier === "primary" ? 0.2 : tier === "secondary" ? 0.045 : 0.012) + proximityCurve * (tier === "primary" ? 0.9 : tier === "secondary" ? 0.78 : 0.68);
      const densityStrength = mobileViewport
        ? tier === "ambient" ? 0 : tier === "secondary" ? 0.52 : 0.92
        : tabletViewport && tier === "ambient" ? 0.5 : 1;
      const visibilityTarget = weight * activation * systemTierStrength[tier] * distanceVisibility * breathe * densityStrength;
      const focusTarget = 0.18 + proximity * 0.82;
      const interpolation = reducedMotion ? 0.22 : 0.065;
      labelVisibility.current[index] = MathUtils.lerp(labelVisibility.current[index] ?? 0, visibilityTarget, interpolation);
      labelFocus.current[index] = MathUtils.lerp(labelFocus.current[index] ?? 0, focusTarget, interpolation * 1.2);

      const side = index % 2 === 0 ? 1 : -1;
      label.position.x = side * 0.18 + (reducedMotion ? 0 : Math.sin(state.clock.elapsedTime * 0.24 + index) * 0.025);
      label.position.y = 0.18 + (reducedMotion ? 0 : Math.sin(state.clock.elapsedTime * 0.31 + index * 0.7) * 0.035);
      label.position.z = reducedMotion ? 0 : Math.cos(state.clock.elapsedTime * 0.19 + index) * 0.018;
      label.scale.setScalar(MathUtils.lerp(label.scale.x, 0.86 + labelFocus.current[index] * 0.16, interpolation));

      label.parent?.getWorldQuaternion(parentQuaternion);
      state.camera.getWorldQuaternion(cameraQuaternion);
      localCameraQuaternion.copy(parentQuaternion).invert().multiply(cameraQuaternion);
      billboardQuaternion.identity().slerp(localCameraQuaternion, reducedMotion ? 0.96 : 0.92);
      label.quaternion.slerp(billboardQuaternion, reducedMotion ? 0.22 : 0.075);

      const visibility = labelVisibility.current[index];
      const focus = labelFocus.current[index];
      labelElement.style.opacity = visibility.toFixed(3);
      labelElement.style.filter = reducedMotion ? "none" : `blur(${((1 - focus) * 4.2).toFixed(2)}px)`;
      labelElement.style.setProperty("--system-label-focus", focus.toFixed(3));
    });

    categoryRefs.current.forEach((category, index) => {
      const categoryElement = categoryElementRefs.current[index];
      if (!category || !categoryElement) return;
      category.getWorldPosition(labelWorldPosition);
      const distance = state.camera.position.distanceTo(labelWorldPosition);
      const proximity = 1 - MathUtils.smoothstep(distance, 5.2, 10.6);
      const angleWindow = reducedMotion ? 0.72 : 0.5 + Math.sin(state.clock.elapsedTime * 0.18 + index * 2.1) * 0.36;
      const categoryDensity = mobileViewport ? 0.28 : tabletViewport ? 0.68 : 1;
      const targetVisibility = weight * inspection * proximity * Math.max(0.08, angleWindow) * 0.42 * categoryDensity;
      categoryVisibility.current[index] = MathUtils.lerp(categoryVisibility.current[index] ?? 0, targetVisibility, reducedMotion ? 0.18 : 0.055);

      category.parent?.getWorldQuaternion(parentQuaternion);
      state.camera.getWorldQuaternion(cameraQuaternion);
      localCameraQuaternion.copy(parentQuaternion).invert().multiply(cameraQuaternion);
      billboardQuaternion.identity().slerp(localCameraQuaternion, 0.88);
      category.quaternion.slerp(billboardQuaternion, reducedMotion ? 0.18 : 0.065);
      categoryElement.style.opacity = categoryVisibility.current[index].toFixed(3);
    });
  });

  return (
    <group ref={groupRef} position={[2.1, 0.2, -31]}>
      <mesh ref={coreRef} material={coreMaterial}>
        <icosahedronGeometry args={[0.74, 2]} />
      </mesh>
      <mesh material={coreHaloMaterial}>
        <sphereGeometry args={[0.79, 36, 24]} />
      </mesh>
      <mesh material={coreLightMaterial}>
        <sphereGeometry args={[0.075, 12, 12]} />
      </mesh>
      <mesh ref={coreCageRef} material={coreCageMaterial}>
        <icosahedronGeometry args={[0.83, 1]} />
      </mesh>
      {[
        [Math.PI / 2, 0, 0],
        [0.42, Math.PI / 2, 0.18],
      ].map((rotation, index) => (
        <mesh key={index} material={coreFrameMaterial} rotation={rotation as [number, number, number]}>
          <torusGeometry args={[0.78, 0.006, 4, 72]} />
        </mesh>
      ))}
      <group ref={coreLabelAnchorRef} position={[0, -1.04, 0.18]}>
        <Html transform center distanceFactor={3} pointerEvents="none" zIndexRange={[6, 2]}>
          <div ref={coreLabelRef} className="system-core-world-label">
            <i />
            <span>DENANDA / FULL-STACK CAPABILITY CORE</span>
          </div>
        </Html>
      </group>
      <pointLight color="#a8e8f8" intensity={1.25} position={[-1.35, 1.1, 1.5]} distance={5} decay={2} />
      {systemOrbits.map((orbit, orbitIndex) => (
        <group key={orbitIndex} rotation={orbit.tilt}>
          <group
            ref={(group) => {
              orbitRefs.current[orbitIndex] = group;
            }}
            rotation={[0, 0, orbitIndex * 0.36]}
          >
            <mesh material={orbitIndex === 0 ? ringMaterial : secondaryRingMaterial}>
              <torusGeometry args={[orbit.radius, orbitIndex === 0 ? 0.012 : orbitIndex === 1 ? 0.006 : 0.005, 5, 112]} />
            </mesh>
            {orbitIndex === 2 ? (
              <mesh material={accentRingMaterial} rotation={[0, 0, 0.72]}>
                <torusGeometry args={[orbit.radius + 0.018, 0.006, 5, 52, Math.PI * 0.42]} />
              </mesh>
            ) : null}
            {nodes.filter((node) => node.orbitIndex === orbitIndex).map(({ index, position, tier, name }) => {
              return (
                <group key={index}>
                  <lineSegments material={lineMaterial}>
                    <bufferGeometry>
                      <bufferAttribute attach="attributes-position" args={[new Float32Array([0, 0, 0, position.x, position.y, 0]), 3]} />
                    </bufferGeometry>
                  </lineSegments>
                  <group position={position}>
                    <mesh
                      ref={(node) => {
                        nodeRefs.current[index] = node;
                      }}
                      material={tier === "primary" ? primaryNodeMaterial : tier === "secondary" ? secondaryNodeMaterial : ambientNodeMaterial}
                    >
                      <sphereGeometry args={[tier === "primary" ? 0.085 : tier === "secondary" ? 0.048 : 0.03, 10, 10]} />
                    </mesh>
                    <group
                      ref={(label) => {
                        labelRefs.current[index] = label;
                      }}
                      position={[index % 2 === 0 ? 0.18 : -0.18, 0.18, 0]}
                    >
                      <Html transform center distanceFactor={3.55} pointerEvents="none" zIndexRange={[7, 2]}>
                        <div
                          ref={(element) => {
                            labelElementRefs.current[index] = element;
                          }}
                          className={`system-orbit-label system-orbit-label--${tier}`}
                        >
                          <i />
                          <span>{name}</span>
                        </div>
                      </Html>
                    </group>
                  </group>
                </group>
              );
            })}
            <group
              ref={(category) => {
                categoryRefs.current[orbitIndex] = category;
              }}
              position={[orbit.radius * 0.72, orbit.radius * 0.69, 0]}
            >
              <Html transform center distanceFactor={2.4} pointerEvents="none" zIndexRange={[5, 1]}>
                <div
                  ref={(element) => {
                    categoryElementRefs.current[orbitIndex] = element;
                  }}
                  className="system-orbit-category"
                >
                  <span>0{orbitIndex + 1}</span>
                  <i />
                  <span>{orbit.label}</span>
                </div>
              </Html>
            </group>
          </group>
        </group>
      ))}
    </group>
  );
}

function ArchiveLocation({
  archiveProgressRef,
  archiveActiveRef,
  reducedMotion,
  isActive,
}: {
  archiveProgressRef: ProgressRef;
  archiveActiveRef: MutableRefObject<boolean>;
  reducedMotion: boolean;
  isActive: boolean;
}) {
  const groupRef = useRef<Group>(null);
  const constellationRef = useRef<Group>(null);
  const leadingOrbRef = useRef<Mesh>(null);
  const cinematicProjects = PROJECTS.slice(0, ARCHIVE_CINEMATIC_LIMIT);
  const constellationProjects = PROJECTS.slice(ARCHIVE_CINEMATIC_LIMIT);
  const transforms = useMemo(
    () => cinematicProjects.map((project, index) => getArchiveVaultTransform(project, index)),
    [cinematicProjects],
  );
  const pathPoints = useMemo(() => getArchiveThreadPoints(PROJECTS).map((point) => new Vector3(...point)), []);
  const threadCurve = useMemo(() => new CatmullRomCurve3(pathPoints, false, "catmullrom", 0.5), [pathPoints]);
  const threadGeometry = useMemo(
    () => new TubeGeometry(threadCurve, Math.max(72, pathPoints.length * 32), 0.018, 5, false),
    [pathPoints.length, threadCurve],
  );
  const threadMaterial = useMemo(
    () => new MeshBasicMaterial({ color: "#9ad9ec", transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }),
    [],
  );
  const leadingOrbMaterial = useMemo(
    () => new MeshBasicMaterial({ color: "#e6f8ff", transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }),
    [],
  );
  const constellationMaterial = useMemo(
    () => new MeshBasicMaterial({ color: "#87bfd2", transparent: true, opacity: 0, depthWrite: false }),
    [],
  );
  const constellationPosition = useMemo(() => getArchiveConstellationPosition(PROJECTS), []);
  const constellationStart = getArchiveConstellationProgressStart(PROJECTS.length);
  const firstArchiveWindow = useMemo(() => getArchiveProgressWindow(0, PROJECTS.length), []);
  const finalArchiveWindow = useMemo(
    () => getArchiveProgressWindow(Math.max(0, cinematicProjects.length - 1), PROJECTS.length),
    [cinematicProjects.length],
  );

  useEffect(() => () => {
    threadGeometry.dispose();
    threadMaterial.dispose();
    leadingOrbMaterial.dispose();
    constellationMaterial.dispose();
  }, [constellationMaterial, leadingOrbMaterial, threadGeometry, threadMaterial]);

  useFrame((state) => {
    if (!isActive || !groupRef.current) return;
    const progress = archiveProgressRef.current;
    const arrival = MathUtils.smoothstep(progress, 0.005, 0.055);
    const departure = 1 - MathUtils.smoothstep(progress, 0.95, 0.995);
    const weight = archiveActiveRef.current ? Math.min(arrival, departure) : 0;
    groupRef.current.visible = weight > 0.004;
    threadMaterial.opacity = weight * 0.28;
    leadingOrbMaterial.opacity = weight * 0.78;
    constellationMaterial.opacity = weight * MathUtils.smoothstep(progress, constellationStart, Math.min(0.99, constellationStart + 0.08)) * 0.34;

    if (leadingOrbRef.current && transforms.length > 0) {
      const railStartX = pathPoints[0].x;
      const railEndX = pathPoints[pathPoints.length - 1].x;
      let orbX = transforms[0].position[0];
      if (progress < firstArchiveWindow.discoveryStart) {
        const amount = MathUtils.smoothstep(progress, 0, firstArchiveWindow.discoveryStart);
        orbX = MathUtils.lerp(railStartX, transforms[0].position[0], amount);
      } else {
        for (let index = 0; index < transforms.length - 1; index += 1) {
          const currentWindow = getArchiveProgressWindow(index, PROJECTS.length);
          const nextWindow = getArchiveProgressWindow(index + 1, PROJECTS.length);
          if (progress >= currentWindow.discoveryEnd && progress < nextWindow.discoveryStart) {
            const amount = MathUtils.smoothstep(progress, currentWindow.discoveryEnd, nextWindow.discoveryStart);
            orbX = MathUtils.lerp(transforms[index].position[0], transforms[index + 1].position[0], amount);
            break;
          }
          if (progress >= nextWindow.discoveryStart) orbX = transforms[index + 1].position[0];
        }
      }
      if (progress > finalArchiveWindow.discoveryEnd) {
        const amount = MathUtils.smoothstep(progress, finalArchiveWindow.discoveryEnd, finalArchiveWindow.exitEnd);
        orbX = MathUtils.lerp(transforms[transforms.length - 1].position[0], railEndX, amount);
      }
      leadingOrbRef.current.position.set(orbX, pathPoints[0].y, pathPoints[0].z);
      leadingOrbRef.current.scale.setScalar(reducedMotion ? 1 : 0.9 + Math.sin(state.clock.elapsedTime * 1.15) * 0.1);
    }

    if (constellationRef.current) {
      const constellationWeight = constellationProjects.length > 0 ? MathUtils.smoothstep(progress, constellationStart, Math.min(0.99, constellationStart + 0.08)) : 0;
      constellationRef.current.visible = constellationWeight > 0.01;
      constellationRef.current.scale.setScalar(0.78 + constellationWeight * 0.22);
      if (!reducedMotion) constellationRef.current.rotation.y = state.clock.elapsedTime * 0.055;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh geometry={threadGeometry} material={threadMaterial} />
      <mesh ref={leadingOrbRef} material={leadingOrbMaterial}>
        <sphereGeometry args={[0.09, 12, 12]} />
      </mesh>
      {cinematicProjects.map((project, index) => {
        const transform = transforms[index];
        return (
          <ArchiveThreadDestination
            key={`archive-destination-${project.id}`}
            project={project}
            index={index}
            totalProjectCount={PROJECTS.length}
            localChapterProgress={archiveProgressRef}
            archiveActive={archiveActiveRef}
            worldPosition={[transform.position[0], transform.position[1] - 1.45, transform.position[2] + 0.42]}
            reducedMotion={reducedMotion}
          />
        );
      })}

      {cinematicProjects.map((project, index) => {
        const transform = transforms[index];
        return (
          <ArchiveVault
            key={project.id}
            project={project}
            index={index}
            totalProjectCount={PROJECTS.length}
            localChapterProgress={archiveProgressRef}
            archiveActive={archiveActiveRef}
            worldPosition={transform.position}
            worldRotation={transform.rotation}
            reducedMotion={reducedMotion}
          />
        );
      })}

      {constellationProjects.length > 0 ? (
        <group ref={constellationRef} position={constellationPosition}>
          {constellationProjects.map((project, index) => {
            const angle = (index / constellationProjects.length) * Math.PI * 2;
            const radius = 1.2 + (index % 3) * 0.32;
            return (
              <group key={project.id} position={[Math.cos(angle) * radius, Math.sin(angle * 1.4) * 0.7, Math.sin(angle) * radius]}>
                <mesh material={constellationMaterial}>
                  <sphereGeometry args={[0.055, 8, 8]} />
                </mesh>
                <Html transform center distanceFactor={1.45} pointerEvents="none">
                  <span className="archive-constellation-label">{project.title}</span>
                </Html>
              </group>
            );
          })}
        </group>
      ) : null}
    </group>
  );
}

function VoidLocation({
  progressRef,
  reducedMotion,
  isActive,
}: {
  progressRef: ProgressRef;
  reducedMotion: boolean;
  isActive: boolean;
}) {
  const groupRef = useRef<Group>(null);
  const handoffPointRef = useRef<Mesh>(null);
  const fragmentPointsRef = useRef<Points>(null);
  const cyanMoteRef = useRef<Mesh>(null);
  const redMoteRef = useRef<Mesh>(null);
  const orbPosition = useMemo(() => new Vector3(0, -0.45, 0.08), []);
  const cyanMotePosition = useMemo(() => new Vector3(), []);
  const redMotePosition = useMemo(() => new Vector3(), []);
  const cyanThreadCurve = useMemo(
    () => new CatmullRomCurve3([
      new Vector3(-6.2, -0.32, -0.72),
      new Vector3(-4.75, -0.66, -0.54),
      new Vector3(-3.15, -0.98, -0.34),
      new Vector3(-1.72, -1.04, -0.16),
      new Vector3(-0.76, -0.78, -0.02),
      new Vector3(-0.36, -0.2, 0.05),
      new Vector3(0.08, 0.03, 0.07),
      new Vector3(0.31, -0.34, 0.05),
      orbPosition.clone(),
    ], false, "catmullrom", 0.52),
    [orbPosition],
  );
  const redThreadCurve = useMemo(
    () => new CatmullRomCurve3([
      new Vector3(6.15, -0.24, -0.68),
      new Vector3(4.72, -0.58, -0.5),
      new Vector3(3.18, -0.92, -0.31),
      new Vector3(1.74, -1.06, -0.14),
      new Vector3(0.8, -0.82, -0.01),
      new Vector3(0.42, -0.21, 0.05),
      new Vector3(-0.04, 0.01, 0.07),
      new Vector3(-0.29, -0.33, 0.05),
      orbPosition.clone(),
    ], false, "catmullrom", 0.52),
    [orbPosition],
  );
  const handoffThreadCurve = useMemo(
    () => new CatmullRomCurve3([
      orbPosition.clone(),
      new Vector3(-0.34, -1.32, -5.2),
      new Vector3(0.28, -1.14, -12.4),
      new Vector3(-0.12, -1.03, -18.8),
      new Vector3(0, -1, -25),
    ], false, "catmullrom", 0.55),
    [orbPosition],
  );
  const cyanOuterCurve = useMemo(
    () => new CatmullRomCurve3(Array.from({ length: 60 }, (_, index) => cyanThreadCurve.getPointAt(index / 59 * 0.82)), false, "catmullrom", 0.5),
    [cyanThreadCurve],
  );
  const redOuterCurve = useMemo(
    () => new CatmullRomCurve3(Array.from({ length: 60 }, (_, index) => redThreadCurve.getPointAt(index / 59 * 0.82)), false, "catmullrom", 0.5),
    [redThreadCurve],
  );
  const cyanInnerCurve = useMemo(
    () => new CatmullRomCurve3(Array.from({ length: 28 }, (_, index) => cyanThreadCurve.getPointAt(0.78 + index / 27 * 0.22)), false, "catmullrom", 0.5),
    [cyanThreadCurve],
  );
  const redInnerCurve = useMemo(
    () => new CatmullRomCurve3(Array.from({ length: 28 }, (_, index) => redThreadCurve.getPointAt(0.78 + index / 27 * 0.22)), false, "catmullrom", 0.5),
    [redThreadCurve],
  );
  const cyanThreadGeometry = useMemo(() => new TubeGeometry(cyanOuterCurve, 72, 0.003, 5, false), [cyanOuterCurve]);
  const redThreadGeometry = useMemo(() => new TubeGeometry(redOuterCurve, 72, 0.0027, 5, false), [redOuterCurve]);
  const cyanInnerGeometry = useMemo(() => new TubeGeometry(cyanInnerCurve, 32, 0.0011, 4, false), [cyanInnerCurve]);
  const redInnerGeometry = useMemo(() => new TubeGeometry(redInnerCurve, 32, 0.001, 4, false), [redInnerCurve]);
  const handoffThreadGeometry = useMemo(() => new TubeGeometry(handoffThreadCurve, 120, 0.003, 5, false), [handoffThreadCurve]);
  const cyanThreadMaterial = useMemo(
    () => new MeshBasicMaterial({ color: "#91def2", transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }),
    [],
  );
  const redThreadMaterial = useMemo(
    () => new MeshBasicMaterial({ color: "#c04455", transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }),
    [],
  );
  const cyanInnerMaterial = useMemo(
    () => new MeshBasicMaterial({ color: "#a7e5f3", transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }),
    [],
  );
  const redInnerMaterial = useMemo(
    () => new MeshBasicMaterial({ color: "#d06070", transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }),
    [],
  );
  const handoffThreadMaterial = useMemo(
    () => new MeshBasicMaterial({ color: "#edf8f6", transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }),
    [],
  );
  const fragmentBasePositions = useMemo(() => {
    const letterAnchors = [
      [-3.75, 0.78], [-3.35, 0.56], [-2.92, 0.88], [-2.35, 0.6], [-1.76, 0.76], [-1.15, 0.5], [-0.5, 0.84], [0.15, 0.58], [0.82, 0.8],
      [-2.95, 0.08], [-2.55, -0.15], [-2.08, 0.15], [-1.45, -0.08], [-0.82, 0.12], [-0.18, -0.18], [0.52, 0.14], [1.22, -0.1], [2.05, 0.08],
      [-3.55, -0.72], [-2.84, -0.92], [-2.1, -0.62], [-1.25, -0.98], [-0.38, -0.7], [0.52, -1], [1.44, -0.66], [2.45, -0.93], [3.42, -0.7],
    ];
    const positions = new Float32Array(letterAnchors.length * 3);
    letterAnchors.forEach(([x, y], index) => {
      positions[index * 3] = x;
      positions[index * 3 + 1] = y;
      positions[index * 3 + 2] = 0.1 + Math.sin((index + 1) * 0.91) * 0.07;
    });
    return positions;
  }, []);
  const fragmentGeometry = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(fragmentBasePositions.slice(), 3));
    return geometry;
  }, [fragmentBasePositions]);
  const fragmentMaterial = useMemo(
    () => new PointsMaterial({ color: "#f1eee4", size: 0.045, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }),
    [],
  );
  const pointMaterial = useMemo(
    () => new MeshBasicMaterial({ color: "#fff5e4", transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }),
    [],
  );

  useEffect(() => () => {
    cyanThreadGeometry.dispose();
    redThreadGeometry.dispose();
    cyanInnerGeometry.dispose();
    redInnerGeometry.dispose();
    handoffThreadGeometry.dispose();
    fragmentGeometry.dispose();
    cyanThreadMaterial.dispose();
    redThreadMaterial.dispose();
    cyanInnerMaterial.dispose();
    redInnerMaterial.dispose();
    handoffThreadMaterial.dispose();
    fragmentMaterial.dispose();
    pointMaterial.dispose();
  }, [cyanInnerGeometry, cyanInnerMaterial, cyanThreadGeometry, cyanThreadMaterial, fragmentGeometry, fragmentMaterial, handoffThreadGeometry, handoffThreadMaterial, pointMaterial, redInnerGeometry, redInnerMaterial, redThreadGeometry, redThreadMaterial]);

  useFrame((state) => {
    if (!isActive || !groupRef.current) return;
    const progress = progressRef.current;
    const visibility = MathUtils.smoothstep(progress, 0.875, 0.895) * (1 - MathUtils.smoothstep(progress, 0.97, 0.992));
    const release = MathUtils.smoothstep(progress, 0.89, 0.908);
    const converge = MathUtils.smoothstep(progress, 0.9, 0.942);
    const fragmentExit = 1 - MathUtils.smoothstep(progress, 0.945, 0.968);
    const threadConvergence = MathUtils.smoothstep(progress, 0.895, 0.912) * (1 - MathUtils.smoothstep(progress, 0.925, 0.942));
    const orbFormation = MathUtils.smoothstep(progress, 0.895, 0.925);
    const orbHandoff = 1 - MathUtils.smoothstep(progress, 0.968, 0.992);
    groupRef.current.visible = visibility > 0.008;
    cyanThreadMaterial.opacity = threadConvergence * 0.11;
    redThreadMaterial.opacity = threadConvergence * 0.095;
    cyanInnerMaterial.opacity = threadConvergence * 0.035;
    redInnerMaterial.opacity = threadConvergence * 0.03;
    handoffThreadMaterial.opacity = orbFormation * orbHandoff * 0.045;
    fragmentMaterial.opacity = visibility * release * fragmentExit * 0.22;
    pointMaterial.opacity = orbFormation * orbHandoff * 0.94;

    const positions = fragmentGeometry.getAttribute("position") as BufferAttribute;
    const elapsed = state.clock.elapsedTime;
    for (let index = 0; index < positions.count; index += 1) {
      const baseX = fragmentBasePositions[index * 3];
      const baseY = fragmentBasePositions[index * 3 + 1];
      const baseZ = fragmentBasePositions[index * 3 + 2];
      const phase = (index + 1) * 0.91;
      const releasedX = baseX + Math.cos(phase) * release * 0.16;
      const releasedY = baseY + Math.sin(phase * 1.7) * release * 0.12;
      const t = converge * converge;
      const inverse = 1 - t;
      const controlX = baseX * 0.32 + Math.sin(phase) * 0.82;
      const controlY = baseY * 0.4 + Math.cos(phase * 1.3) * 0.52;
      const controlZ = baseZ + Math.sin(phase * 0.7) * 0.24;
      const drift = reducedMotion ? 0 : Math.sin(elapsed * 0.22 + phase) * 0.024 * release * inverse;
      positions.setXYZ(
        index,
        inverse * inverse * releasedX + 2 * inverse * t * controlX + t * t * orbPosition.x + drift,
        inverse * inverse * releasedY + 2 * inverse * t * controlY + t * t * orbPosition.y,
        inverse * inverse * baseZ + 2 * inverse * t * controlZ + t * t * orbPosition.z,
      );
    }
    positions.needsUpdate = true;

    if (fragmentPointsRef.current && !reducedMotion) {
      fragmentPointsRef.current.rotation.z = Math.sin(elapsed * 0.09) * 0.0025 * (1 - converge);
    }
    const threadPull = MathUtils.smoothstep(progress, 0.902, 0.934);
    cyanThreadCurve.getPointAt(threadPull, cyanMotePosition);
    redThreadCurve.getPointAt(threadPull, redMotePosition);
    cyanMoteRef.current?.position.copy(cyanMotePosition);
    redMoteRef.current?.position.copy(redMotePosition);
    if (handoffPointRef.current) {
      const pulse = reducedMotion ? 1 : 1 + Math.sin(elapsed * 0.72) * 0.055;
      handoffPointRef.current.scale.setScalar(MathUtils.lerp(0.18, 1.14, orbFormation) * pulse);
    }
  });

  return (
    <group ref={groupRef} position={[0, 2.1, -91]}>
      <mesh geometry={cyanThreadGeometry} material={cyanThreadMaterial} />
      <mesh geometry={redThreadGeometry} material={redThreadMaterial} />
      <mesh geometry={cyanInnerGeometry} material={cyanInnerMaterial} />
      <mesh geometry={redInnerGeometry} material={redInnerMaterial} />
      <mesh ref={cyanMoteRef} material={cyanThreadMaterial}>
        <sphereGeometry args={[0.055, 10, 10]} />
      </mesh>
      <mesh ref={redMoteRef} material={redThreadMaterial}>
        <sphereGeometry args={[0.055, 10, 10]} />
      </mesh>
      <points ref={fragmentPointsRef} geometry={fragmentGeometry} material={fragmentMaterial} />
      <mesh ref={handoffPointRef} material={pointMaterial} position={orbPosition}>
        <sphereGeometry args={[0.09, 14, 14]} />
      </mesh>
      <mesh geometry={handoffThreadGeometry} material={handoffThreadMaterial} />
    </group>
  );
}

function FinalSignal({ progressRef, reducedMotion, isActive }: { progressRef: ProgressRef; reducedMotion: boolean; isActive: boolean }) {
  const groupRef = useRef<Group>(null);
  const pointRef = useRef<Mesh>(null);
  const ringOneRef = useRef<Mesh>(null);
  const ringTwoRef = useRef<Mesh>(null);
  const particlePointsRef = useRef<Points>(null);
  const cyanCurve = useMemo(
    () => new CatmullRomCurve3([
      new Vector3(-1.55, -0.5, 0.34),
      new Vector3(-1.08, -0.72, 0.2),
      new Vector3(-0.42, -0.36, 0.06),
      new Vector3(0, 0, 0),
    ], false, "catmullrom", 0.55),
    [],
  );
  const redCurve = useMemo(
    () => new CatmullRomCurve3([
      new Vector3(1.45, -0.48, 0.34),
      new Vector3(0.96, -0.7, 0.2),
      new Vector3(0.38, -0.34, 0.06),
      new Vector3(0, 0, 0),
    ], false, "catmullrom", 0.55),
    [],
  );
  const cyanGeometry = useMemo(() => new TubeGeometry(cyanCurve, 56, 0.0015, 4, false), [cyanCurve]);
  const redGeometry = useMemo(() => new TubeGeometry(redCurve, 56, 0.0012, 4, false), [redCurve]);
  const particleSourcePositions = useMemo(() => {
    const positions = new Float32Array(18 * 3);
    for (let index = 0; index < 18; index += 1) {
      const angle = index * 2.399963;
      const radius = 0.48 + (index % 6) * 0.12;
      positions[index * 3] = Math.cos(angle) * radius;
      positions[index * 3 + 1] = Math.sin(angle) * radius * 0.62;
      positions[index * 3 + 2] = Math.sin((index + 1) * 1.37) * 0.18;
    }
    return positions;
  }, []);
  const particleGeometry = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(particleSourcePositions.slice(), 3));
    return geometry;
  }, [particleSourcePositions]);
  const pointMaterial = useMemo(
    () => new MeshBasicMaterial({ color: "#fff7e8", transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }),
    [],
  );
  const ringMaterial = useMemo(
    () => new MeshBasicMaterial({ color: "#bfe7f1", transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }),
    [],
  );
  const cyanMaterial = useMemo(
    () => new MeshBasicMaterial({ color: "#81d5ed", transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }),
    [],
  );
  const redMaterial = useMemo(
    () => new MeshBasicMaterial({ color: "#b63d4d", transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }),
    [],
  );
  const particleMaterial = useMemo(
    () => new PointsMaterial({ color: "#e6f3f2", size: 0.016, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }),
    [],
  );

  useEffect(() => () => {
    cyanGeometry.dispose();
    redGeometry.dispose();
    particleGeometry.dispose();
    pointMaterial.dispose();
    ringMaterial.dispose();
    cyanMaterial.dispose();
    redMaterial.dispose();
    particleMaterial.dispose();
  }, [cyanGeometry, cyanMaterial, particleGeometry, particleMaterial, pointMaterial, redGeometry, redMaterial, ringMaterial]);

  useFrame((state) => {
    if (!isActive || !groupRef.current) return;
    const progress = progressRef.current;
    const arrival = MathUtils.smoothstep(progress, 0.895, 0.92);
    const convergence = MathUtils.smoothstep(progress, 0.905, 0.93);
    const ringWeight = MathUtils.smoothstep(progress, 0.918, 0.942);
    const resolve = MathUtils.smoothstep(progress, 0.94, 0.975);
    groupRef.current.visible = arrival > 0.008;
    groupRef.current.position.y = MathUtils.lerp(1.1, 0.15, resolve);
    pointMaterial.opacity = arrival * 0.88;
    ringMaterial.opacity = ringWeight * 0.075;
    cyanMaterial.opacity = arrival * MathUtils.lerp(0.042, 0.022, resolve);
    redMaterial.opacity = arrival * MathUtils.lerp(0.034, 0.017, resolve);
    particleMaterial.opacity = arrival * MathUtils.lerp(0.11, 0.05, resolve);

    const positions = particleGeometry.getAttribute("position") as BufferAttribute;
    const particleRadius = MathUtils.lerp(1, 0.08, convergence);
    for (let index = 0; index < positions.count; index += 1) {
      positions.setXYZ(
        index,
        particleSourcePositions[index * 3] * particleRadius,
        particleSourcePositions[index * 3 + 1] * particleRadius,
        particleSourcePositions[index * 3 + 2] * particleRadius,
      );
    }
    positions.needsUpdate = true;

    const pulse = reducedMotion ? 1 : 1 + Math.sin(state.clock.elapsedTime * 0.9) * 0.045;
    pointRef.current?.scale.setScalar(pulse);
    ringOneRef.current?.scale.setScalar(0.88 + ringWeight * 0.18);
    ringTwoRef.current?.scale.setScalar(0.82 + ringWeight * 0.26);
    if (particlePointsRef.current && !reducedMotion) particlePointsRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.11) * 0.03 * (1 - convergence);
  });

  return (
    <group ref={groupRef} position={[0, 1.1, -116]}>
      <mesh geometry={cyanGeometry} material={cyanMaterial} />
      <mesh geometry={redGeometry} material={redMaterial} />
      <points ref={particlePointsRef} geometry={particleGeometry} material={particleMaterial} />
      <mesh ref={pointRef} material={pointMaterial}>
        <sphereGeometry args={[0.09, 16, 16]} />
      </mesh>
      <mesh ref={ringOneRef} material={ringMaterial} rotation={[0.04, 0.06, 0]}>
        <torusGeometry args={[0.44, 0.004, 5, 64]} />
      </mesh>
      <mesh ref={ringTwoRef} material={ringMaterial} rotation={[-0.07, 0.11, 0.08]}>
        <torusGeometry args={[0.66, 0.003, 5, 64]} />
      </mesh>
    </group>
  );
}

function WorldMood({ progressRef, isActive }: { progressRef: ProgressRef; isActive: boolean }) {
  const fogRef = useRef<Fog>(null);
  useFrame(() => {
    if (!isActive || !fogRef.current) return;
    const progress = progressRef.current;
    const quiet = MathUtils.smoothstep(progress, 0.72, 0.88);
    const listeningQuiet = chapterWeight(progress, 0.535, 0.845, 0.06);
    const voidQuiet = chapterWeight(progress, 0.7, 0.95, 0.04);
    const finalQuiet = MathUtils.smoothstep(progress, 0.89, 0.94);
    const baseNear = MathUtils.lerp(12, 8, quiet);
    const baseFar = MathUtils.lerp(58, 39, quiet);
    fogRef.current.near = MathUtils.lerp(MathUtils.lerp(MathUtils.lerp(baseNear, 6.2, listeningQuiet), 7.2, voidQuiet), 5.6, finalQuiet);
    fogRef.current.far = MathUtils.lerp(MathUtils.lerp(MathUtils.lerp(baseFar, 27, listeningQuiet), 25.5, voidQuiet), 20.5, finalQuiet);
    fogRef.current.color.setRGB(
      MathUtils.lerp(MathUtils.lerp(MathUtils.lerp(MathUtils.lerp(0.008, 0.003, quiet), 0.002, listeningQuiet), 0.0015, voidQuiet), 0.001, finalQuiet),
      MathUtils.lerp(MathUtils.lerp(MathUtils.lerp(MathUtils.lerp(0.024, 0.006, quiet), 0.007, listeningQuiet), 0.0045, voidQuiet), 0.003, finalQuiet),
      MathUtils.lerp(MathUtils.lerp(MathUtils.lerp(MathUtils.lerp(0.038, 0.012, quiet), 0.012, listeningQuiet), 0.011, voidQuiet), 0.008, finalQuiet),
    );
  });
  return <fog ref={fogRef} attach="fog" args={["#02060a", 12, 58]} />;
}

function PlanetWorldScene({
  progressRef,
  archiveProgressRef,
  archiveActiveRef,
  listeningPlaybackRef,
  reducedMotion,
  isActive,
  profile,
}: {
  progressRef: ProgressRef;
  archiveProgressRef: ProgressRef;
  archiveActiveRef: MutableRefObject<boolean>;
  listeningPlaybackRef: MutableRefObject<ListeningPlaybackSnapshot>;
  reducedMotion: boolean;
  isActive: boolean;
  profile: "desktop" | "tablet" | "mobile";
}) {
  return (
    <>
      <color attach="background" args={["#010308"]} />
      <WorldMood progressRef={progressRef} isActive={isActive} />
      <ambientLight color="#8ab8c7" intensity={0.2} />
      <pointLight color="#a9e6f7" intensity={4.2} position={[-6, 7, 12]} distance={42} decay={2} />
      <pointLight color="#fff1db" intensity={2.2} position={[8, 3, -54]} distance={36} decay={2} />
      <CameraJourney
        progressRef={progressRef}
        archiveProgressRef={archiveProgressRef}
        archiveActiveRef={archiveActiveRef}
        listeningPlaybackRef={listeningPlaybackRef}
        reducedMotion={reducedMotion}
        isActive={isActive}
        profile={profile}
      />
      <PlanetArrival progressRef={progressRef} reducedMotion={reducedMotion} isActive={isActive} />
      <LandingTrail progressRef={progressRef} reducedMotion={reducedMotion} isActive={isActive} />
      <DigitalTerrain progressRef={progressRef} isActive={isActive} />
      <AmbientStarfield progressRef={progressRef} reducedMotion={reducedMotion} isActive={isActive} />
      <WorldThread
        progressRef={progressRef}
        archiveProgressRef={archiveProgressRef}
        archiveActiveRef={archiveActiveRef}
        listeningPlaybackRef={listeningPlaybackRef}
        reducedMotion={reducedMotion}
        isActive={isActive}
      />
      <MemoryLocation progressRef={progressRef} reducedMotion={reducedMotion} isActive={isActive} profile={profile} />
      <SystemLocation progressRef={progressRef} reducedMotion={reducedMotion} isActive={isActive} />
      <ArchiveLocation
        archiveProgressRef={archiveProgressRef}
        archiveActiveRef={archiveActiveRef}
        reducedMotion={reducedMotion}
        isActive={isActive}
      />
      <ListeningCapsuleWorld
        progressRef={progressRef}
        playbackRef={listeningPlaybackRef}
        reducedMotion={reducedMotion}
        isActive={isActive}
      />
      <VoidLocation progressRef={progressRef} reducedMotion={reducedMotion} isActive={isActive} />
      <FinalSignal progressRef={progressRef} reducedMotion={reducedMotion} isActive={isActive} />
      <EffectComposer multisampling={0}>
        <Bloom intensity={0.72} luminanceThreshold={0.42} mipmapBlur radius={0.52} />
      </EffectComposer>
    </>
  );
}

export function PlanetWorldJourneySection({ children }: { children: ReactNode }) {
  const sectionRef = useRef<HTMLElement>(null);
  const progressRef = useRef(0);
  const archiveProgressRef = useRef(0);
  const archiveActiveRef = useRef(false);
  const listeningPlaybackRef = useRef<ListeningPlaybackSnapshot>({
    currentTime: 0,
    duration: 29,
    isPlaying: false,
    hasStarted: false,
    completed: false,
    skipped: false,
    level: 0,
  });
  const [isActive, setIsActive] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const { profile, isLandscape } = useResponsiveProfile();
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 58, damping: 24, mass: 0.42 });
  const semanticProgress = useTransform(smoothProgress, (value) => remapJourneyProgressForArchive(value, PROJECTS.length, profile));
  const journeyContext = useMemo(
    () => ({ progress: semanticProgress, reducedMotion, archiveProgressRef, archiveActiveRef }),
    [reducedMotion, semanticProgress],
  );
  const entryOpacity = useTransform(semanticProgress, [0, 0.018, 0.075, 0.125], [0, 1, 1, 0]);
  const entryY = useTransform(semanticProgress, [0, 0.04, 0.125], reducedMotion ? [0, 0, 0] : [22, 0, -32]);

  useEffect(() => semanticProgress.on("change", (value) => {
    progressRef.current = value;
  }), [semanticProgress]);

  const previousViewportRef = useRef({ profile, isLandscape });
  useEffect(() => {
    const previousViewport = previousViewportRef.current;
    if (previousViewport.profile === profile && previousViewport.isLandscape === isLandscape) return;
    previousViewportRef.current = { profile, isLandscape };

    const activeSection = sectionRef.current;
    if (!activeSection) return;
    const activeSectionTop = window.scrollY + activeSection.getBoundingClientRect().top;
    const viewportAnchor = window.scrollY + window.innerHeight * 0.5;
    if (viewportAnchor < activeSectionTop || viewportAnchor > activeSectionTop + activeSection.offsetHeight) return;

    const semanticPosition = progressRef.current;
    const timeout = window.setTimeout(() => {
      const section = sectionRef.current;
      if (!section) return;
      const rawPosition = getRawJourneyProgress(semanticPosition, PROJECTS.length, profile);
      const sectionTop = window.scrollY + section.getBoundingClientRect().top;
      const travel = Math.max(1, section.offsetHeight - window.innerHeight);
      window.scrollTo({ top: sectionTop + travel * rawPosition, left: 0, behavior: "instant" });
    }, 160);

    return () => window.clearTimeout(timeout);
  }, [isLandscape, profile]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    if (typeof IntersectionObserver === "undefined") {
      setIsActive(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setIsActive(entry.isIntersecting), {
      rootMargin: "260px 0px",
      threshold: 0.005,
    });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="planet-world-journey" aria-label="Planet world journey">
      <div className="planet-world__canvas-layer">
        <div className="planet-world__canvas-sticky">
          <Canvas
            camera={{ position: [0, 7.2, 28], fov: 54, near: 0.05, far: 190 }}
              dpr={[1, profile === "desktop" ? 1.55 : profile === "tablet" ? 1.45 : 1.3]}
            frameloop={isActive ? "always" : "never"}
            gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
            className="absolute inset-0 h-full w-full"
          >
            <PlanetWorldScene
              progressRef={progressRef}
              archiveProgressRef={archiveProgressRef}
              archiveActiveRef={archiveActiveRef}
              listeningPlaybackRef={listeningPlaybackRef}
              reducedMotion={reducedMotion}
              isActive={isActive}
              profile={profile}
            />
          </Canvas>
          <div className="planet-world__vignette" />
        </div>
      </div>

      <PlanetJourneyContext.Provider value={journeyContext}>
        <div className="planet-world__content">
          <div className="planet-entry-stage" aria-label="Chapter 01 — Planet Entry">
            <motion.div className="planet-entry-stage__signal" style={{ opacity: entryOpacity, y: entryY }}>
              <span className="font-label-caps">01 / PLANET ENTRY</span>
              <i />
              <span className="font-label-caps">ATMOSPHERIC LINK ESTABLISHED</span>
            </motion.div>
          </div>
          {children}
        </div>
      </PlanetJourneyContext.Provider>
    </section>
  );
}
