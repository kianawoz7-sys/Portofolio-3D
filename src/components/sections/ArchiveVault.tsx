import type { CSSProperties, MutableRefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  DoubleSide,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Quaternion,
} from "three";

import type { Project } from "../../data/projects";
import { resolveProjectComposition } from "../../data/projects";
import type { WorldVector } from "../../lib/archiveJourney";
import { getArchiveActiveProjectIndex, getArchiveProgressWindow } from "../../lib/archiveJourney";

interface ArchiveVaultProps {
  project: Project;
  index: number;
  totalProjectCount: number;
  localChapterProgress: MutableRefObject<number>;
  archiveActive: MutableRefObject<boolean>;
  worldPosition: WorldVector;
  worldRotation: WorldVector;
  reducedMotion: boolean;
}

function padVaultNumber(index: number) {
  return String(index + 1).padStart(2, "0");
}

function applyArtifactStage(element: HTMLElement | null, visibility: number, travel: number, depth = 0) {
  if (!element) return;
  const value = MathUtils.clamp(visibility, 0, 1);
  element.style.opacity = value.toFixed(3);
  element.style.filter = `blur(${((1 - value) * 4).toFixed(2)}px)`;
  element.style.transform = `translate3d(0, ${((1 - value) * travel).toFixed(2)}px, ${depth}px)`;
}

interface ArchiveThreadDestinationProps {
  project: Project;
  index: number;
  totalProjectCount: number;
  localChapterProgress: MutableRefObject<number>;
  archiveActive: MutableRefObject<boolean>;
  worldPosition: WorldVector;
  reducedMotion: boolean;
}

export function ArchiveThreadDestination({
  project,
  index,
  totalProjectCount,
  localChapterProgress,
  archiveActive,
  worldPosition,
  reducedMotion,
}: ArchiveThreadDestinationProps) {
  const groupRef = useRef<Group>(null);
  const labelAnchorRef = useRef<Group>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const parentQuaternion = useMemo(() => new Quaternion(), []);
  const cameraQuaternion = useMemo(() => new Quaternion(), []);
  const localCameraQuaternion = useMemo(() => new Quaternion(), []);
  const billboardQuaternion = useMemo(() => new Quaternion(), []);
  const ranges = useMemo(() => getArchiveProgressWindow(index, totalProjectCount), [index, totalProjectCount]);
  const direction = resolveProjectComposition(project, index);
  const accentColor = project.accent?.color ?? "#9eddf1";
  const nodeMaterial = useMemo(
    () => new MeshBasicMaterial({ color: accentColor, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }),
    [accentColor],
  );

  useEffect(() => () => nodeMaterial.dispose(), [nodeMaterial]);

  useFrame((state) => {
    const group = groupRef.current;
    const labelAnchor = labelAnchorRef.current;
    const label = labelRef.current;
    if (!group || !labelAnchor || !label) return;

    const progress = localChapterProgress.current;
    const activeIndex = getArchiveActiveProjectIndex(progress, totalProjectCount);
    const arrival = MathUtils.smoothstep(progress, ranges.approachStart, ranges.discoveryStart);
    const crossfadeEnd = ranges.discoveryStart + (ranges.discoveryEnd - ranges.discoveryStart) * 0.2;
    const contentHandoff = 1 - MathUtils.smoothstep(progress, ranges.discoveryStart, crossfadeEnd);
    const visibility = archiveActive.current ? Math.min(arrival, contentHandoff) : 0;
    const nodeFocus = activeIndex === index ? 1 : Math.abs(activeIndex - index) === 1 ? 0.26 : 0.08;

    group.visible = archiveActive.current;
    nodeMaterial.opacity = (0.12 + nodeFocus * 0.54) * (0.3 + Math.max(arrival, visibility) * 0.7);
    group.scale.setScalar(0.82 + nodeFocus * 0.18);

    labelAnchor.position.x = (direction === "left" ? -0.42 : 0.42) + (reducedMotion ? 0 : Math.sin(state.clock.elapsedTime * 0.22 + index) * 0.025);
    labelAnchor.position.y = -0.2 + (reducedMotion ? 0 : Math.sin(state.clock.elapsedTime * 0.28 + index * 0.7) * 0.025);
    labelAnchor.position.z = 0.12;
    labelAnchor.scale.setScalar(0.9 + visibility * 0.1);

    labelAnchor.parent?.getWorldQuaternion(parentQuaternion);
    state.camera.getWorldQuaternion(cameraQuaternion);
    localCameraQuaternion.copy(parentQuaternion).invert().multiply(cameraQuaternion);
    billboardQuaternion.identity().slerp(localCameraQuaternion, 0.9);
    labelAnchor.quaternion.slerp(billboardQuaternion, reducedMotion ? 0.2 : 0.07);

    label.style.opacity = visibility.toFixed(3);
    label.style.filter = reducedMotion ? "none" : `blur(${((1 - visibility) * 3.5).toFixed(2)}px)`;
  });

  return (
    <group ref={groupRef} position={worldPosition}>
      <mesh material={nodeMaterial}>
        <sphereGeometry args={[0.072, 10, 10]} />
      </mesh>
      <mesh material={nodeMaterial} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.15, 0.008, 5, 32]} />
      </mesh>
      <group ref={labelAnchorRef} position={[direction === "left" ? -0.42 : 0.42, -0.2, 0.12]}>
        <Html transform center distanceFactor={1.75} pointerEvents="none" zIndexRange={[6, 2]}>
          <div ref={labelRef} className="archive-destination-label">
            <span>PROJECT {padVaultNumber(index)}</span>
            <i />
            <span>{project.title}</span>
          </div>
        </Html>
      </group>
    </group>
  );
}

export function ArchiveVault({
  project,
  index,
  totalProjectCount,
  localChapterProgress,
  archiveActive,
  worldPosition,
  worldRotation,
  reducedMotion,
}: ArchiveVaultProps) {
  const groupRef = useRef<Group>(null);
  const gateRef = useRef<Group>(null);
  const contentAnchorRef = useRef<Group>(null);
  const horizontalRailRefs = useRef<Array<Mesh | null>>([]);
  const verticalRailRefs = useRef<Array<Mesh | null>>([]);
  const panelRef = useRef<HTMLElement>(null);
  const panelFrameRef = useRef<HTMLDivElement>(null);
  const visualRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const descriptionRef = useRef<HTMLDivElement>(null);
  const tagsRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLElement>(null);
  const detailStateRef = useRef<"active" | "near" | "distant">("distant");
  const [isNearby, setIsNearby] = useState(index < 2);
  const ranges = useMemo(() => getArchiveProgressWindow(index, totalProjectCount), [index, totalProjectCount]);
  const direction = resolveProjectComposition(project, index);
  const accentColor = project.accent?.color ?? "#9eddf1";
  const panelStyle = { "--archive-vault-accent": accentColor } as CSSProperties;

  const glassMaterial = useMemo(
    () => new MeshPhysicalMaterial({
      color: "#6f9cad",
      emissive: "#102d39",
      emissiveIntensity: 0.18,
      transparent: true,
      opacity: 0,
      roughness: 0.2,
      metalness: 0.08,
      transmission: 0.76,
      thickness: 0.16,
      ior: 1.2,
      depthWrite: false,
      side: DoubleSide,
    }),
    [],
  );
  const frameMaterial = useMemo(
    () => new MeshBasicMaterial({ color: accentColor, transparent: true, opacity: 0, depthWrite: false }),
    [accentColor],
  );
  const railMaterial = useMemo(
    () => new MeshBasicMaterial({ color: accentColor, transparent: true, opacity: 0, depthWrite: false }),
    [accentColor],
  );
  const structureMaterial = useMemo(
    () => new MeshStandardMaterial({ color: "#0b1b24", emissive: "#12313f", emissiveIntensity: 0.22, transparent: true, opacity: 0, roughness: 0.58, metalness: 0.36, depthWrite: false }),
    [],
  );
  const signalMaterial = useMemo(
    () => new MeshBasicMaterial({ color: accentColor, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }),
    [accentColor],
  );

  useEffect(() => () => {
    glassMaterial.dispose();
    frameMaterial.dispose();
    railMaterial.dispose();
    structureMaterial.dispose();
    signalMaterial.dispose();
  }, [frameMaterial, glassMaterial, railMaterial, signalMaterial, structureMaterial]);

  useEffect(() => {
    const preloadedImage = new window.Image();
    preloadedImage.src = project.imagePath;
    void preloadedImage.decode?.().catch(() => undefined);
  }, [project.imagePath]);

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;

    const progress = localChapterProgress.current;
    const activeIndex = getArchiveActiveProjectIndex(progress, totalProjectCount);
    const distanceFromActive = Math.abs(index - activeIndex);
    const nextDetailState = distanceFromActive === 0 ? "active" : distanceFromActive === 1 ? "near" : "distant";
    const shouldBeNearby = archiveActive.current && distanceFromActive <= 1;
    if (detailStateRef.current !== nextDetailState) detailStateRef.current = nextDetailState;
    if (shouldBeNearby !== isNearby) setIsNearby(shouldBeNearby);

    const chapterStrength = archiveActive.current ? 1 : 0;
    const isLastVault = index === Math.min(totalProjectCount, 5) - 1;
    const approachDuration = Math.max(0.001, ranges.discoveryStart - ranges.approachStart);
    const prewarmStart = index === 0
      ? ranges.approachStart
      : Math.max(0, ranges.approachStart - Math.min(0.04, approachDuration * 0.2));
    const approachReveal = MathUtils.smoothstep(progress, prewarmStart, ranges.discoveryStart);
    const transitionProgress = MathUtils.smoothstep(progress, ranges.transitStart, ranges.exitEnd);
    const residualEnd = Math.min(1, ranges.exitEnd + Math.max(0.035, (ranges.discoveryEnd - ranges.discoveryStart) * 0.24));
    const residualRelease = 1 - MathUtils.smoothstep(progress, ranges.exitEnd, residualEnd);
    const inspectionHold = MathUtils.smoothstep(progress, ranges.discoveryStart, ranges.discoveryStart + 0.008)
      * (1 - MathUtils.smoothstep(progress, ranges.discoveryEnd - 0.008, ranges.discoveryEnd));

    let panelVisibility = 0;
    if (progress < ranges.approachStart && index > 0) {
      panelVisibility = 0.25 * MathUtils.smoothstep(progress, prewarmStart, ranges.approachStart);
    } else if (progress < ranges.discoveryStart) {
      panelVisibility = index === 0
        ? MathUtils.smoothstep(progress, ranges.approachStart, ranges.discoveryStart)
        : MathUtils.lerp(0.25, 1, MathUtils.smoothstep(progress, ranges.approachStart, ranges.discoveryStart));
    } else if (progress <= ranges.discoveryEnd) {
      panelVisibility = 1;
    } else if (progress <= ranges.exitEnd) {
      panelVisibility = isLastVault ? 1 - transitionProgress : MathUtils.lerp(1, 0.25, transitionProgress);
    } else if (!isLastVault) {
      panelVisibility = 0.25 * residualRelease;
    }
    panelVisibility *= chapterStrength;

    const gateExit = isLastVault ? transitionProgress : MathUtils.smoothstep(progress, ranges.transitStart, ranges.exitEnd);
    const cornerReveal = approachReveal * (1 - gateExit);
    const railDraw = MathUtils.smoothstep(approachReveal, 0.08, 0.58);
    const railRelease = 1 - MathUtils.smoothstep(approachReveal, 0.66, 1);
    const gateDiscovery = MathUtils.smoothstep(approachReveal, 0.6, 1);
    const contentResidual = isLastVault ? 1 - transitionProgress : residualRelease;

    const ambientDrift = MathUtils.lerp(0.045, 0.012, inspectionHold);
    group.position.y = worldPosition[1] + (reducedMotion ? 0 : Math.sin(state.clock.elapsedTime * 0.2 + index) * ambientDrift);
    if (gateRef.current) {
      const gateScale = MathUtils.lerp(1.22, 1, approachReveal) + gateExit * 0.075;
      gateRef.current.scale.setScalar(gateScale);
      gateRef.current.position.z = MathUtils.lerp(-0.26, 0.02, approachReveal) - gateExit * 0.12;
    }
    horizontalRailRefs.current.forEach((rail) => rail?.scale.set(Math.max(0.001, railDraw), 1, 1));
    verticalRailRefs.current.forEach((rail) => rail?.scale.set(1, Math.max(0.001, railDraw), 1));

    glassMaterial.opacity = chapterStrength * railDraw * railRelease * 0.018;
    frameMaterial.opacity = chapterStrength * cornerReveal * MathUtils.lerp(0.3, 0.075, gateDiscovery);
    railMaterial.opacity = chapterStrength * railDraw * railRelease * 0.2;
    structureMaterial.opacity = chapterStrength * cornerReveal * MathUtils.lerp(0.22, 0.045, gateDiscovery) * (1 - gateExit);
    signalMaterial.opacity = chapterStrength * cornerReveal * MathUtils.lerp(0.36, 0.08, gateDiscovery) * (1 - gateExit);

    if (contentAnchorRef.current) {
      const panelScale = 0.94 + approachReveal * 0.06 - gateExit * 0.035;
      contentAnchorRef.current.scale.setScalar(panelScale);
      contentAnchorRef.current.position.z = MathUtils.lerp(-0.12, 0.22, approachReveal) - gateExit * 0.22;
    }

    if (panelRef.current) {
      panelRef.current.style.opacity = panelVisibility.toFixed(3);
      panelRef.current.style.filter = reducedMotion ? "none" : `blur(${((1 - panelVisibility) * 12).toFixed(2)}px)`;
      panelRef.current.style.pointerEvents = panelVisibility > 0.9 ? "auto" : "none";
      panelRef.current.setAttribute("aria-hidden", panelVisibility > 0.08 ? "false" : "true");
    }

    const frameStage = chapterStrength * MathUtils.smoothstep(approachReveal, 0.05, 0.36) * contentResidual;
    const imageStage = chapterStrength * MathUtils.smoothstep(approachReveal, 0.12, 0.48) * contentResidual;
    const titleStage = chapterStrength * MathUtils.smoothstep(approachReveal, 0.2, 0.58) * contentResidual;
    const descriptionStage = chapterStrength * MathUtils.smoothstep(approachReveal, 0.3, 0.7) * contentResidual;
    const tagsStage = chapterStrength * MathUtils.smoothstep(approachReveal, 0.42, 0.84) * contentResidual;
    const actionStage = chapterStrength * MathUtils.smoothstep(approachReveal, 0.55, 1) * contentResidual;
    applyArtifactStage(panelFrameRef.current, frameStage, 7);
    applyArtifactStage(visualRef.current, imageStage, 16, 34);
    applyArtifactStage(titleRef.current, titleStage, 13);
    applyArtifactStage(descriptionRef.current, descriptionStage, 11);
    applyArtifactStage(tagsRef.current, tagsStage, 9);
    applyArtifactStage(actionRef.current, actionStage, 7);
  });

  return (
    <group ref={groupRef} position={worldPosition} rotation={worldRotation}>
      <group ref={gateRef}>
        <mesh material={glassMaterial}>
          <planeGeometry args={[5.76, 3.34]} />
        </mesh>

        {[
          [-1, -1], [-1, 1], [1, -1], [1, 1],
        ].map(([sideX, sideY]) => (
          <group key={`${sideX}-${sideY}`} position={[sideX * 2.88, sideY * 1.67, 0.06]}>
            <mesh material={frameMaterial} position={[-sideX * 0.27, 0, 0]}><boxGeometry args={[0.54, 0.022, 0.022]} /></mesh>
            <mesh material={frameMaterial} position={[0, -sideY * 0.23, 0]}><boxGeometry args={[0.022, 0.46, 0.022]} /></mesh>
          </group>
        ))}

        {[-1, 1].map((sideY, railIndex) => (
          <mesh
            key={`horizontal-${sideY}`}
            ref={(rail) => { horizontalRailRefs.current[railIndex] = rail; }}
            material={railMaterial}
            position={[0, sideY * 1.67, 0.04]}
          >
            <boxGeometry args={[4.62, 0.009, 0.009]} />
          </mesh>
        ))}
        {[-1, 1].map((sideX, railIndex) => (
          <mesh
            key={`vertical-${sideX}`}
            ref={(rail) => { verticalRailRefs.current[railIndex] = rail; }}
            material={railMaterial}
            position={[sideX * 2.88, 0, 0.04]}
          >
            <boxGeometry args={[0.009, 2.5, 0.009]} />
          </mesh>
        ))}

        <mesh material={structureMaterial} position={[0, -1.88, -0.16]}>
          <boxGeometry args={[3.1, 0.1, 0.72]} />
        </mesh>
        <mesh material={signalMaterial} position={[direction === "left" ? -2.88 : 2.88, -1.67, 0.1]}>
          <sphereGeometry args={[0.06, 10, 10]} />
        </mesh>
      </group>

      <group ref={contentAnchorRef} position={[0, 0, -0.12]}>
        <Html transform center distanceFactor={2.45} pointerEvents="auto" zIndexRange={[8, 3]}>
          <article
            ref={panelRef}
            className={`archive-vault-panel archive-vault-panel--${direction}`}
            style={panelStyle}
          >
            <div ref={panelFrameRef} className="archive-vault-panel__topline">
              <span>VAULT / {padVaultNumber(index)}</span>
              <i />
              <span>{project.accent?.signal ?? project.category}</span>
            </div>

            <div className="archive-vault-panel__body">
              <div ref={visualRef} className="archive-vault-panel__visual">
                <div className="archive-vault-panel__depth-frame" />
                {isNearby ? (
                  <img
                    src={project.imagePath}
                    alt={project.imageAlt}
                    loading={index < 2 ? "eager" : "lazy"}
                    decoding="async"
                    fetchPriority={index === 0 ? "high" : "auto"}
                  />
                ) : null}
                <span className="archive-vault-panel__scanline" />
              </div>

              <div className="archive-vault-panel__copy">
                <span className="archive-vault-panel__number">{padVaultNumber(index)}</span>
                <span className="archive-vault-panel__category">{project.shortCategory}</span>
                <h3 ref={titleRef}>{project.title}</h3>
                <div ref={descriptionRef} className="archive-vault-panel__details">
                  <p>{project.compactDescription ?? project.description}</p>
                  <span className="archive-vault-panel__system">{project.artifactLabel}</span>
                  {project.featureHighlights?.length ? (
                    <ul className="archive-vault-panel__features" aria-label={`${project.title} feature highlights`}>
                      {project.featureHighlights.map((feature) => <li key={feature}>{feature}</li>)}
                    </ul>
                  ) : null}
                </div>
                <div ref={tagsRef} className="archive-vault-panel__tags">
                  {project.technologyStack.map((technology) => <span key={technology}>{technology}</span>)}
                </div>
                {project.caseStudyUrl ? (
                  <a
                    ref={(element) => { actionRef.current = element; }}
                    href={project.caseStudyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="archive-vault-panel__link"
                    aria-label={`${project.ctaLabel} — ${project.title}`}
                  >
                    {project.ctaLabel} <span aria-hidden="true">{"\u2192"}</span>
                  </a>
                ) : (
                  <span
                    ref={(element) => { actionRef.current = element; }}
                    className="archive-vault-panel__link archive-vault-panel__link--disabled"
                    aria-disabled="true"
                  >
                    {project.ctaLabel}
                  </span>
                )}
              </div>
            </div>
          </article>
        </Html>
      </group>
    </group>
  );
}
