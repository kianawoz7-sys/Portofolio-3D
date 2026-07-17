import type { CSSProperties, MutableRefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { ArrowRight, Pause, Play, SkipForward, Volume2 } from "lucide-react";
import {
  AdditiveBlending,
  DoubleSide,
  Group,
  InstancedMesh,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  Object3D,
} from "three";

export interface ListeningPlaybackSnapshot {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  hasStarted: boolean;
  completed: boolean;
  skipped: boolean;
  level: number;
}

interface ListeningCapsuleWorldProps {
  progressRef: MutableRefObject<number>;
  playbackRef: MutableRefObject<ListeningPlaybackSnapshot>;
  reducedMotion: boolean;
  isActive: boolean;
}

interface AudioGraph {
  context: AudioContext;
  analyser: AnalyserNode;
  data: Uint8Array;
}

type ListeningPlayerStyle = CSSProperties & {
  "--capsule-progress": string;
  "--capsule-energy": number;
};

const WAVEFORM_HEIGHTS = [18, 31, 24, 42, 34, 54, 29, 47, 64, 38, 51, 72, 45, 61, 35, 58, 76, 49, 67, 41, 57, 33, 48, 27, 39, 21];
const CAPSULE_ORBIT_ROTATIONS = [
  [Math.PI / 2, 0, 0],
  [0.42, Math.PI / 2, 0.18],
  [-0.28, 0.36, Math.PI / 2],
] as const;
const AUDIO_ORBIT_NODE_POSITIONS = [
  [2.5, 0.18, 0.3],
  [-1.38, 1.72, -0.38],
  [0.72, -2.05, 0.5],
  [-2.12, -0.82, -0.16],
] as const;

function smoothRange(value: number, start: number, end: number) {
  return MathUtils.smoothstep(value, start, Math.max(start + 0.001, end));
}

function capsuleWeight(progress: number) {
  const enter = smoothRange(progress, 0.555, 0.61);
  const exit = 1 - smoothRange(progress, 0.78, 0.825);
  return Math.min(enter, exit);
}

function playbackEnvelope(time: number, duration: number) {
  if (time <= 4) return smoothRange(time, 0, 4) * 0.56;
  if (time <= 20) return 0.56;
  if (time <= 26) return MathUtils.lerp(0.56, 1, smoothRange(time, 20, 26));
  return 1 - smoothRange(time, 26, Math.max(27, duration));
}

function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const seconds = Math.floor(value);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function ListeningCapsuleWorld({
  progressRef,
  playbackRef,
  reducedMotion,
  isActive,
}: ListeningCapsuleWorldProps) {
  const groupRef = useRef<Group>(null);
  const shellRef = useRef<Mesh>(null);
  const signalRef = useRef<Mesh>(null);
  const particleRef = useRef<InstancedMesh>(null);
  const audioReactiveOrbitGroupRef = useRef<Group>(null);
  const orbitRefs = useRef<Array<Mesh | null>>([]);
  const orbitNodeRefs = useRef<Array<Mesh | null>>([]);
  const waveformRefs = useRef<Array<Mesh | null>>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const artworkRef = useRef<HTMLImageElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioGraphRef = useRef<AudioGraph | null>(null);
  const progressFrameRef = useRef<number | null>(null);
  const particleDummy = useMemo(() => new Object3D(), []);
  const smoothedLevelRef = useRef(0);
  const smoothedBassRef = useRef(0);
  const beatTransientRef = useRef(0);
  const previousBassEnergyRef = useRef(0);
  const beatLatchRef = useRef(false);
  const lastBeatTimeRef = useRef(-1);
  const orbitGroupAngleRef = useRef(0);
  const orbitGroupAngularVelocityRef = useRef(0.09);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(29);
  const [volume, setVolume] = useState(0.82);

  const particles = useMemo(
    () => Array.from({ length: 18 }, (_, index) => {
      const angle = index * 2.39996;
      const radius = 1.46 + (index % 4) * 0.18;
      const baseX = Math.cos(angle) * radius;
      const baseY = ((index % 7) - 3) * 0.25;
      const baseZ = Math.sin(angle) * radius * 0.4;
      const inverseLength = 1 / Math.max(0.001, Math.hypot(baseX, baseY, baseZ));
      return {
        baseX,
        baseY,
        baseZ,
        directionX: baseX * inverseLength,
        directionY: baseY * inverseLength,
        directionZ: baseZ * inverseLength,
        phase: index * 1.731,
        driftSpeed: 0.1 + (index % 5) * 0.014,
        scale: 0.026 + (index % 4) * 0.005,
        audioWeight: index % 7 === 0 ? 1 : 0.32 + (index % 3) * 0.12,
        foreground: index % 7 === 0,
      };
    }),
    [],
  );

  const glassMaterial = useMemo(
    () => new MeshPhysicalMaterial({
      color: "#171513",
      emissive: "#090807",
      emissiveIntensity: 0.1,
      transparent: true,
      opacity: 0,
      transmission: 0.58,
      thickness: 0.28,
      ior: 1.12,
      roughness: 0.46,
      metalness: 0.08,
      side: DoubleSide,
      depthWrite: false,
    }),
    [],
  );
  const arcMaterial = useMemo(
    () => new MeshBasicMaterial({ color: "#d9d1c6", transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }),
    [],
  );
  const ivoryMaterial = useMemo(
    () => new MeshBasicMaterial({ color: "#fff3dc", transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }),
    [],
  );
  const redMaterial = useMemo(
    () => new MeshBasicMaterial({ color: "#a63848", transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }),
    [],
  );
  const particleMaterial = useMemo(
    () => new MeshBasicMaterial({ color: "#d8d0c5", transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }),
    [],
  );
  const waveformMaterial = useMemo(
    () => new MeshBasicMaterial({ color: "#e8dfd1", transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }),
    [],
  );
  const backdropMaterial = useMemo(
    () => new MeshBasicMaterial({ color: "#050404", transparent: true, opacity: 0, depthWrite: false, side: DoubleSide }),
    [],
  );

  const ensureAudioGraph = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audioGraphRef.current) {
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.84;
      const source = context.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(context.destination);
      audioGraphRef.current = { context, analyser, data: new Uint8Array(analyser.frequencyBinCount) };
    }
    if (audioGraphRef.current.context.state === "suspended") await audioGraphRef.current.context.resume();
  }, []);

  const stopProgressLoop = useCallback(() => {
    if (progressFrameRef.current === null) return;
    window.cancelAnimationFrame(progressFrameRef.current);
    progressFrameRef.current = null;
  }, []);

  const startProgressLoop = useCallback(() => {
    stopProgressLoop();

    const tick = () => {
      const audio = audioRef.current;
      if (!audio || audio.paused || audio.ended) {
        progressFrameRef.current = null;
        return;
      }
      setCurrentTime(Number.isFinite(audio.currentTime) ? audio.currentTime : 0);
      progressFrameRef.current = window.requestAnimationFrame(tick);
    };

    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(Number.isFinite(audio.currentTime) ? audio.currentTime : 0);
    progressFrameRef.current = window.requestAnimationFrame(tick);
  }, [stopProgressLoop]);

  const continueJourney = useCallback(() => {
    document.getElementById("philosophy")?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  }, [reducedMotion]);

  const togglePlayback = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    const resolvedDuration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : duration;
    const shouldRestart = audio.ended || hasEnded || audio.currentTime >= resolvedDuration - 0.05;
    if (shouldRestart) {
      audio.currentTime = 0;
      setCurrentTime(0);
      setHasEnded(false);
      setCompleted(false);
      setSkipped(false);
    }
    try {
      await audio.play();
      setIsPlaying(true);
      setHasEnded(false);
      startProgressLoop();
      void ensureAudioGraph().catch(() => undefined);
    } catch (error) {
      console.warn("Listening Capsule playback could not start.", error);
      setIsPlaying(false);
    }
  }, [duration, ensureAudioGraph, hasEnded, startProgressLoop]);

  const skipExperience = useCallback(() => {
    const audio = audioRef.current;
    audio?.pause();
    stopProgressLoop();
    setHasEnded(false);
    setSkipped(true);
    setCompleted(true);
    playbackRef.current = { ...playbackRef.current, isPlaying: false, completed: true, skipped: true, level: 0 };
    window.requestAnimationFrame(continueJourney);
  }, [continueJourney, playbackRef, stopProgressLoop]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const syncCurrentTime = () => {
      setCurrentTime(Number.isFinite(audio.currentTime) ? audio.currentTime : 0);
    };

    const syncDuration = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
        syncCurrentTime();
      }
    };
    const handlePlay = () => {
      setIsPlaying(true);
      setHasStarted(true);
      setHasEnded(false);
      setCompleted(false);
      setSkipped(false);
      startProgressLoop();
    };
    const handlePause = () => {
      stopProgressLoop();
      syncCurrentTime();
      setIsPlaying(false);
    };
    const handleEnded = () => {
      stopProgressLoop();
      const finalDuration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 29;
      setIsPlaying(false);
      setHasEnded(true);
      setCompleted(true);
      setDuration(finalDuration);
      setCurrentTime(finalDuration);
    };

    audio.addEventListener("loadedmetadata", syncDuration);
    audio.addEventListener("durationchange", syncDuration);
    audio.addEventListener("timeupdate", syncCurrentTime);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    syncDuration();
    if (!audio.paused && !audio.ended) startProgressLoop();

    return () => {
      stopProgressLoop();
      audio.removeEventListener("loadedmetadata", syncDuration);
      audio.removeEventListener("durationchange", syncDuration);
      audio.removeEventListener("timeupdate", syncCurrentTime);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [startProgressLoop, stopProgressLoop]);

  useEffect(() => {
    if (isActive) return;
    audioRef.current?.pause();
    stopProgressLoop();
  }, [isActive, stopProgressLoop]);

  useEffect(() => () => {
    stopProgressLoop();
    const graph = audioGraphRef.current;
    if (graph && graph.context.state !== "closed") void graph.context.close();
    glassMaterial.dispose();
    arcMaterial.dispose();
    ivoryMaterial.dispose();
    redMaterial.dispose();
    particleMaterial.dispose();
    waveformMaterial.dispose();
    backdropMaterial.dispose();
  }, [arcMaterial, backdropMaterial, glassMaterial, ivoryMaterial, particleMaterial, redMaterial, stopProgressLoop, waveformMaterial]);

  useFrame((state, delta) => {
    const group = groupRef.current;
    const audio = audioRef.current;
    if (!isActive || !group || !audio) return;

    const chapterProgress = progressRef.current;
    const chapterVisibility = capsuleWeight(chapterProgress);
    const localProgress = MathUtils.clamp((chapterProgress - 0.555) / (0.825 - 0.555), 0, 1);
    const audioTime = audio.currentTime;
    const audioDuration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : duration;
    const playing = !audio.paused && !audio.ended;
    if (chapterVisibility < 0.008 && playing) audio.pause();

    const graph = audioGraphRef.current;
    let measuredLevel = 0;
    let bassLevel = 0;
    if (graph && playing) {
      graph.analyser.getByteFrequencyData(graph.data);
      let total = 0;
      for (let index = 2; index < graph.data.length; index += 1) total += graph.data[index];
      measuredLevel = total / Math.max(1, graph.data.length - 2) / 255;

      const nyquist = graph.context.sampleRate / 2;
      const bassStart = Math.max(1, Math.floor((35 / nyquist) * graph.data.length));
      const bassEnd = Math.min(
        graph.data.length,
        Math.max(bassStart + 1, Math.ceil((220 / nyquist) * graph.data.length) + 1),
      );
      let bassTotal = 0;
      for (let index = bassStart; index < bassEnd; index += 1) bassTotal += graph.data[index];
      bassLevel = bassTotal / Math.max(1, bassEnd - bassStart) / 255;
    }
    const safeDelta = Math.min(delta, 0.05);
    const targetEnergy = MathUtils.clamp(measuredLevel, 0, 0.72);
    const responseRate = targetEnergy > smoothedLevelRef.current ? 6.32 : 1.52;
    const damping = 1 - Math.exp(-responseRate * safeDelta);
    smoothedLevelRef.current = MathUtils.clamp(
      smoothedLevelRef.current + (targetEnergy - smoothedLevelRef.current) * damping,
      0,
      0.72,
    );

    const targetBass = MathUtils.clamp(bassLevel, 0, 0.9);
    const previousBass = smoothedBassRef.current;
    const bassResponseRate = targetBass > previousBass ? 10.46 : 2.14;
    const bassDamping = 1 - Math.exp(-bassResponseRate * safeDelta);
    smoothedBassRef.current = MathUtils.clamp(previousBass + (targetBass - previousBass) * bassDamping, 0, 0.9);

    const transientInput = Math.max(0, targetBass - previousBass);
    const transientTarget = playing
      ? MathUtils.clamp(transientInput * 3.6 + Math.max(0, targetBass - 0.28) * 0.42, 0, 1)
      : 0;
    const transientRate = transientTarget > beatTransientRef.current ? 10.46 : 2.2;
    const transientDamping = 1 - Math.exp(-transientRate * safeDelta);
    beatTransientRef.current = MathUtils.clamp(
      beatTransientRef.current + (transientTarget - beatTransientRef.current) * transientDamping,
      0,
      1,
    );

    const activation = hasStarted ? smoothRange(audioTime, 0, 4) : 0;
    const envelope = playbackEnvelope(audioTime, audioDuration);
    const closing = completed ? 1 : smoothRange(audioTime, 26, audioDuration);
    const audioEnergy = playing
      ? MathUtils.clamp(envelope * (0.34 + smoothedLevelRef.current * 1.28), 0, 1)
      : hasStarted && !completed ? envelope * 0.09 : 0;
    const bassEnergy = smoothedBassRef.current;
    const beatTransient = beatTransientRef.current;
    const reactiveLevel = MathUtils.clamp(audioEnergy * 0.62 + bassEnergy * 0.3 + beatTransient * 0.38, 0, 1);
    const beatSignal = bassEnergy * 0.45 + beatTransient * 0.8;
    const risingBass = bassEnergy - previousBassEnergyRef.current;
    const currentBeatTime = state.clock.elapsedTime;
    const cooldownPassed = currentBeatTime - lastBeatTimeRef.current >= 0.14;

    if (beatSignal < 0.15 || beatTransient < 0.055) beatLatchRef.current = false;
    const beatDetected = playing
      && !beatLatchRef.current
      && cooldownPassed
      && beatSignal >= 0.18
      && (beatTransient >= 0.08 || risingBass >= 0.01);
    if (beatDetected) {
      const beatImpulse = 0.075 + Math.min(0.055, beatTransient * 0.055);
      orbitGroupAngularVelocityRef.current = Math.min(0.36, orbitGroupAngularVelocityRef.current + beatImpulse);
      beatLatchRef.current = true;
      lastBeatTimeRef.current = currentBeatTime;
    }
    previousBassEnergyRef.current = bassEnergy;

    orbitGroupAngularVelocityRef.current = MathUtils.damp(
      orbitGroupAngularVelocityRef.current,
      0.09,
      1.65,
      safeDelta,
    );
    orbitGroupAngleRef.current += orbitGroupAngularVelocityRef.current * safeDelta * (reducedMotion ? 0.15 : 1);

    if (audioReactiveOrbitGroupRef.current) {
      audioReactiveOrbitGroupRef.current.rotation.y = orbitGroupAngleRef.current;
      audioReactiveOrbitGroupRef.current.rotation.z = 0.035 + Math.sin(orbitGroupAngleRef.current * 0.45) * 0.08;
    }
    const visualWeight = chapterVisibility * (0.68 + activation * 0.32);
    const scrollInspection = smoothRange(localProgress, 0.2, 0.35) * (1 - smoothRange(localProgress, 0.8, 1));
    const inspectionFocus = Math.max(scrollInspection, playing ? chapterVisibility : 0);
    const playerOpacity = Math.max(chapterVisibility * 0.58, inspectionFocus);

    playbackRef.current = {
      currentTime: audioTime,
      duration: audioDuration,
      isPlaying: playing,
      hasStarted,
      completed,
      skipped,
      level: reactiveLevel,
    };

    group.visible = chapterVisibility > 0.004;
    group.scale.setScalar(0.72 + visualWeight * 0.28);
    const inspectionStillness = MathUtils.lerp(1, 0.08, inspectionFocus);
    group.position.y = 0.7 + (reducedMotion ? 0 : Math.sin(state.clock.elapsedTime * 0.16) * 0.025 * chapterVisibility * inspectionStillness);
    group.rotation.y = -0.075 + (reducedMotion ? 0 : Math.sin(state.clock.elapsedTime * 0.08) * 0.012 * inspectionStillness);

    glassMaterial.opacity = visualWeight * (0.035 + activation * 0.04 + beatTransient * 0.018) * (1 - closing * 0.7);
    arcMaterial.opacity = visualWeight * (0.11 + bassEnergy * 0.16 + beatTransient * 0.12) * (1 - closing * 0.72);
    ivoryMaterial.opacity = visualWeight * (0.32 + audioEnergy * 0.22 + beatTransient * 0.16) * (1 - closing * 0.82);
    redMaterial.opacity = visualWeight * (0.12 + bassEnergy * 0.15 + beatTransient * 0.12) * (1 - closing * 0.68);
    particleMaterial.opacity = visualWeight * (0.25 + bassEnergy * 0.22 + beatTransient * 0.18) * (1 - closing * 0.6);
    waveformMaterial.opacity = visualWeight * (0.08 + audioEnergy * 0.48) * (1 - closing);
    backdropMaterial.opacity = chapterVisibility * 0.32 * (1 - closing * 0.72);

    if (shellRef.current) shellRef.current.scale.setScalar(0.94 + activation * 0.06 - closing * 0.1);
    if (signalRef.current) {
      const idlePulse = reducedMotion ? 0 : Math.sin(state.clock.elapsedTime * 1.1) * 0.025;
      const pulse = 1 + idlePulse + bassEnergy * 0.055 + beatTransient * 0.15;
      signalRef.current.scale.setScalar(pulse);
    }

    orbitRefs.current.forEach((orbit, index) => {
      if (!orbit) return;
      const ringExpansion = 1 + bassEnergy * 0.012 + beatTransient * (index === 1 ? 0.028 : 0.014);
      orbit.scale.setScalar(ringExpansion * (1 - closing * (0.08 + index * 0.025)));
    });

    orbitNodeRefs.current.forEach((node, index) => {
      if (!node) return;
      const nodePulse = 1 + bassEnergy * (0.045 + index * 0.006) + beatTransient * (0.12 + index * 0.018);
      node.scale.setScalar(nodePulse * (1 - closing * 0.7));
    });

    waveformRefs.current.forEach((bar, index) => {
      if (!bar) return;
      const wave = 0.18 + Math.abs(Math.sin(state.clock.elapsedTime * (1.5 + (index % 4) * 0.22) + index * 0.74)) * 0.82;
      const scale = Math.max(0.035, (0.08 + audioEnergy * wave) * (1 - closing));
      bar.scale.y = reducedMotion ? Math.max(0.06, audioEnergy * 0.45) : scale;
    });

    if (particleRef.current) {
      const particleTime = state.clock.elapsedTime;
      particles.forEach((particle, index) => {
        const driftAmount = reducedMotion ? 0 : 1;
        const driftX = Math.sin(particleTime * particle.driftSpeed + particle.phase) * 0.024 * driftAmount;
        const driftY = Math.cos(particleTime * particle.driftSpeed * 0.82 + particle.phase) * 0.03 * driftAmount;
        const driftZ = Math.sin(particleTime * particle.driftSpeed * 0.68 + particle.phase * 1.31) * 0.018 * driftAmount;
        const baseScale = (1 - closing * 0.96) * (0.86 + activation * 0.14);
        const rhythmicExpansion = 1 + bassEnergy * 0.02 + beatTransient * (particle.foreground ? 0.055 : 0.028);
        const audioBreath = Math.sin(particleTime * 0.72 + particle.phase) * 0.5 + 0.5;
        const audioOffset = (bassEnergy * 0.018 + beatTransient * (particle.foreground ? 0.05 : 0.025)) * particle.audioWeight * audioBreath;
        const particleX = particle.baseX * baseScale * rhythmicExpansion + particle.directionX * audioOffset + driftX;
        const particleY = particle.baseY * baseScale * rhythmicExpansion + particle.directionY * audioOffset + driftY;
        const particleZ = particle.baseZ * baseScale * rhythmicExpansion + particle.directionZ * audioOffset + driftZ;
        particleDummy.position.set(
          MathUtils.lerp(particleX, 0, closing),
          MathUtils.lerp(particleY, -1.52, closing),
          MathUtils.lerp(particleZ, 0.22, closing),
        );
        const twinkle = reducedMotion ? 1 : 1 + Math.sin(particleTime * 0.45 + particle.phase) * 0.035;
        const audioScale = 1 + bassEnergy * 0.08 * particle.audioWeight + beatTransient * (particle.foreground ? 0.16 : 0.1) * particle.audioWeight;
        const scale = particle.scale * twinkle * audioScale * (1 - closing * 0.55);
        particleDummy.scale.setScalar(scale);
        particleDummy.updateMatrix();
        particleRef.current?.setMatrixAt(index, particleDummy.matrix);
      });
      particleRef.current.instanceMatrix.needsUpdate = true;
    }

    if (panelRef.current) {
      panelRef.current.style.opacity = playerOpacity.toFixed(3);
      panelRef.current.style.filter = "none";
      panelRef.current.style.setProperty("--capsule-energy", (0.12 + reactiveLevel * 0.88).toFixed(3));
      panelRef.current.style.setProperty("--capsule-close", closing.toFixed(3));
      panelRef.current.setAttribute("data-focused", inspectionFocus > 0.2 ? "true" : "false");
      panelRef.current.style.pointerEvents = inspectionFocus > 0.2 ? "auto" : "none";
    }
    if (artworkRef.current) {
      artworkRef.current.style.opacity = (0.78 + inspectionFocus * 0.22).toFixed(3);
      artworkRef.current.style.filter = `saturate(${(0.76 + activation * 0.12).toFixed(2)}) contrast(1.04) brightness(${(0.76 + inspectionFocus * 0.2).toFixed(2)})`;
    }
  });

  const progressPercentage = MathUtils.clamp((currentTime / Math.max(0.001, duration)) * 100, 0, 100);
  const visualEnergy = isPlaying ? playbackEnvelope(currentTime, duration) : 0;
  const playerStyle = {
    "--capsule-progress": `${progressPercentage.toFixed(3)}%`,
    "--capsule-energy": 0.12 + visualEnergy * 0.88,
  } as ListeningPlayerStyle;

  return (
    <group ref={groupRef} position={[4.1, 0.7, -68]} rotation={[0.015, -0.075, 0.008]}>
      <mesh material={backdropMaterial} position={[0, 0, -0.7]}>
        <circleGeometry args={[4.35, 64]} />
      </mesh>
      <mesh ref={shellRef} material={glassMaterial}>
        <sphereGeometry args={[3.05, 42, 28]} />
      </mesh>

      <group ref={audioReactiveOrbitGroupRef} rotation={[0, 0, 0.035]}>
        {CAPSULE_ORBIT_ROTATIONS.map((rotation, index) => (
          <mesh
            key={index}
            ref={(mesh) => { orbitRefs.current[index] = mesh; }}
            material={index === 2 ? redMaterial : arcMaterial}
            rotation={rotation as [number, number, number]}
          >
            <torusGeometry args={[2.72 - index * 0.28, index === 2 ? 0.012 : 0.016, 5, 96, Math.PI * (index === 1 ? 1.58 : 1.82)]} />
          </mesh>
        ))}

        {AUDIO_ORBIT_NODE_POSITIONS.map((position, index) => (
          <mesh
            key={`orbit-node-${index}`}
            ref={(mesh) => { orbitNodeRefs.current[index] = mesh; }}
            material={index === 2 ? redMaterial : ivoryMaterial}
            position={position as [number, number, number]}
          >
            <sphereGeometry args={[index === 0 ? 0.065 : 0.042 + index * 0.004, 10, 10]} />
          </mesh>
        ))}

        <instancedMesh ref={particleRef} args={[undefined, undefined, particles.length]} material={particleMaterial}>
          <sphereGeometry args={[1, 6, 6]} />
        </instancedMesh>
      </group>

      <group position={[0, -1.18, -0.2]}>
        {WAVEFORM_HEIGHTS.slice(0, 22).map((height, index) => (
          <mesh
            key={index}
            ref={(mesh) => { waveformRefs.current[index] = mesh; }}
            material={waveformMaterial}
            position={[(index - 10.5) * 0.16, 0, 0]}
            scale={[1, 0.04, 1]}
          >
            <boxGeometry args={[0.024, height / 90, 0.02]} />
          </mesh>
        ))}
      </group>

      <mesh ref={signalRef} material={ivoryMaterial} position={[0, -1.52, 0.22]}>
        <sphereGeometry args={[0.075, 12, 12]} />
      </mesh>
      <mesh material={redMaterial} position={[0, -1.52, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.18, 0.009, 5, 40]} />
      </mesh>

      <Html
        transform
        center
        occlude={false}
        distanceFactor={2.05}
        position={[0, 0.08, 0.34]}
        pointerEvents="auto"
        zIndexRange={[100, 50]}
        style={{ pointerEvents: "auto", filter: "none" }}
      >
        <div
          ref={panelRef}
          className="listening-capsule-player"
          data-testid="listening-player"
          data-playing={isPlaying}
          data-ended={hasEnded}
          data-complete={completed}
          style={playerStyle}
        >
          <audio ref={audioRef} preload="none" src="/Music/Good-life.mpeg" />

          <div className="listening-capsule-player__topline font-label-caps">
            <span>PRIVATE LISTENING STATION / 05</span>
            <i />
            <span>{completed ? "MEMORY COMPLETE" : isPlaying ? "SIGNAL IN PROGRESS" : "READY FOR INPUT"}</span>
          </div>

          <div className="listening-capsule-player__body">
            <div className="listening-capsule-artifact">
              <div className="listening-capsule-artifact__orbit" aria-hidden="true"><i /><i /></div>
              <div className="listening-capsule-artifact__frame">
                <img
                  ref={artworkRef}
                  src="/Meteor.webp"
                  alt="Good Life cover artwork"
                  width={941}
                  height={1672}
                  loading="lazy"
                  decoding="async"
                  fetchPriority="low"
                  draggable={false}
                />
              </div>
              <div className="listening-capsule-artifact__meta">
                <span className="font-label-caps">PRESERVED MEMORY / 05</span>
                <strong className="font-headline-md">Good Life</strong>
                <small>G-Eazy, Kehlani</small>
              </div>
            </div>

            <div className="listening-capsule-player__content">
              <div className="listening-capsule-player__identity">
                <div className="listening-capsule-player__eyebrow font-label-caps">
                  <span>PERSONAL AUDIO ARTIFACT</span>
                  <span>29 SEC / USER INITIATED MEMORY</span>
                </div>
                <h3 className="font-headline-md">Good Life</h3>
                <p>G-Eazy, Kehlani</p>
              </div>

              <div className="listening-capsule-memory-copy">
                <span className="font-label-caps">A MOMENT I CHOSE TO KEEP</span>
                <p>Some moments are not saved to be replayed forever. Just long enough to remember how they felt.</p>
              </div>

              <div className="listening-capsule-waveform" aria-hidden="true">
                {WAVEFORM_HEIGHTS.map((height, index) => (
                  <i key={index} style={{ "--bar-height": `${height}%`, "--bar-index": index } as CSSProperties} />
                ))}
              </div>

              <div className="listening-capsule-timeline">
                <input
                  aria-label="Seek through Good Life"
                  type="range"
                  min={0}
                  max={100}
                  step={0.01}
                  value={progressPercentage}
                  onChange={(event) => {
                    const nextPercentage = MathUtils.clamp(Number(event.currentTarget.value), 0, 100);
                    const nextTime = (nextPercentage / 100) * Math.max(0, duration);
                    if (audioRef.current) audioRef.current.currentTime = nextTime;
                    setCurrentTime(nextTime);
                    const seekedToEnd = duration > 0 && nextTime >= duration - 0.05;
                    setHasEnded(seekedToEnd);
                    setCompleted(seekedToEnd);
                  }}
                />
                <div className="listening-capsule-timeline__time font-label-caps">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              <div className="listening-capsule-controls" data-testid="listening-player-controls">
                <button className="listening-capsule-controls__play" type="button" onClick={() => void togglePlayback()} aria-label={isPlaying ? "Pause Good Life" : hasEnded ? "Replay Good Life" : "Play Good Life"}>
                  {isPlaying ? <Pause size={16} strokeWidth={1.6} /> : <Play size={16} strokeWidth={1.6} />}
                  <span>{isPlaying ? "Pause moment" : hasEnded ? "Replay moment" : "Play moment"}</span>
                </button>

                <label className="listening-capsule-volume" aria-label="Volume">
                  <Volume2 size={14} strokeWidth={1.5} />
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={volume}
                    onChange={(event) => {
                      const nextVolume = Number(event.currentTarget.value);
                      setVolume(nextVolume);
                      if (audioRef.current) audioRef.current.volume = nextVolume;
                    }}
                  />
                </label>

                <button className="listening-capsule-controls__skip" type="button" onClick={skipExperience}>
                  <SkipForward size={13} strokeWidth={1.5} />
                  <span>Skip experience</span>
                </button>
              </div>

              {completed ? (
                <button className="listening-capsule-continue" type="button" onClick={continueJourney}>
                  <span>Continue the journey</span>
                  <ArrowRight size={14} strokeWidth={1.4} />
                </button>
              ) : (
                <p className="listening-capsule-player__note" aria-live="polite">
                  {hasStarted ? "The signal will close after this selected moment." : "Press play when you are ready. Audio never starts automatically."}
                </p>
              )}
            </div>
          </div>
        </div>
      </Html>
    </group>
  );
}
